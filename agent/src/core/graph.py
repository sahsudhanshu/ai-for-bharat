"""
LangGraph graph definition — the core agent orchestration.

Graph flow:
  ┌──────────────┐
  │ language_guard│──rejected──► END (rejection message)
  └──────┬───────┘
         │ accepted
  ┌──────▼───────┐
  │ load_context  │  (memory + region + catch context)
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │    agent      │◄─────────┐
  └──────┬───────┘          │
         │                   │
    has_tool_calls?          │
      yes │    no            │
  ┌───────▼──────┐          │
  │ tool_executor │──────────┘
  └──────────────┘
         │ (no more tool calls)
  ┌──────▼───────┐
  │ memory_update │
  └──────┬───────┘
         │
        END
"""
from __future__ import annotations
from typing import Any, Dict, Literal

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import StateGraph, END

# Primary LLM: Amazon Nova Pro via AWS Bedrock
try:
    from langchain_aws import ChatBedrockConverse as _ChatBedrock
    _BEDROCK_AVAILABLE = True
except ImportError:
    _BEDROCK_AVAILABLE = False

# Fallback LLM: Google Gemini (used when Bedrock is unavailable)
try:
    from langchain_google_genai import ChatGoogleGenerativeAI as _ChatGemini
    _GEMINI_AVAILABLE = True
except ImportError:
    _GEMINI_AVAILABLE = False

from src.core.state import AgentState
from src.core.prompts import build_system_prompt
from src.memory.manager import build_message_history, extract_and_update_long_term_memory
from src.memory.dynamodb_store import get_long_term_memory
from src.utils.languages import validate_language, get_rejection_message
from src.tools.weather import get_weather
from src.tools.catch_history import get_catch_history
from src.tools.specific_catch import get_catch_details
from src.tools.map_data import get_map_data
from src.tools.market_prices import get_market_prices
from src.tools.group_history import get_group_history
from src.tools.get_group_details import get_group_details
from src.tools.web_search import web_search
from src.tools.fishing_spots import get_nearby_fishing_spots

# Import RAG integration
try:
    from rag_agent_integration import create_rag_tool, retrieve_rag_context_async
    RAG_AVAILABLE = True
except ImportError:
    RAG_AVAILABLE = False
    print("⚠ RAG not available - Bedrock KB integration skipped")

# ── All tools the agent can invoke ───────────────────────────────────────────
TOOLS = [get_weather, get_catch_history, get_catch_details, get_map_data, get_market_prices, get_group_history, get_group_details, web_search, get_nearby_fishing_spots]
if RAG_AVAILABLE:
    TOOLS.append(create_rag_tool())

# ── LLM with tools bound ────────────────────────────────────────────────────
def _get_llm():
    import os

    # ── Primary: Amazon Nova Pro via AWS Bedrock Converse API ────────────────
    if _BEDROCK_AVAILABLE:
        model_id = os.getenv("BEDROCK_LLM_MODEL_ID", "us.amazon.nova-pro-v1:0")
        region   = os.getenv("BEDROCK_REGION", "us-east-1")
        api_key  = os.getenv("BEDROCK_API_KEY", "") or None
        llm = _ChatBedrock(
            model=model_id,
            region_name=region,
            temperature=0.7,
            max_tokens=4096,
            bedrock_api_key=api_key,
        )
        return llm.bind_tools(TOOLS)

    # ── Fallback: Google Gemini ──────────────────────────────────────────────
    if _GEMINI_AVAILABLE:
        import logging
        logging.warning("langchain-aws not installed; falling back to Google Gemini")
        google_api_key = os.getenv("GOOGLE_API_KEY", "")
        model_id       = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        llm = _ChatGemini(
            model=model_id,
            google_api_key=google_api_key,
            temperature=0.7,
            max_output_tokens=4096,
            streaming=True,
        )
        return llm.bind_tools(TOOLS)

    raise RuntimeError(
        "No LLM backend available. Install langchain-aws (recommended) or "
        "langchain-google-genai and set GOOGLE_API_KEY."
    )




# ─────────────────────────────────────────────────────────────────────────────
# Node: language_guard
# ─────────────────────────────────────────────────────────────────────────────

async def language_guard(state: AgentState) -> Dict[str, Any]:
    """Validate that the user's input matches the selected language."""
    text = state["human_input"]
    lang = state.get("selected_language", "en")
    accepted, reason = validate_language(text, lang)

    if not accepted:
        rejection = get_rejection_message(lang)
        if reason:
            rejection = f"{reason}\n\n{rejection}"
        return {
            "language_accepted": False,
            "language_rejection": rejection,
        }

    return {"language_accepted": True, "language_rejection": None}


# ─────────────────────────────────────────────────────────────────────────────
# Node: load_context
# ─────────────────────────────────────────────────────────────────────────────

async def load_context(state: AgentState) -> Dict[str, Any]:
    """Load memory, summary, and any relevant context into state."""
    conversation_id = state["conversation_id"]
    user_id = state["user_id"]
    lang = state.get("selected_language", "en")

    # Build message history (last N verbatim + summary of older)
    recent_messages, summary = await build_message_history(conversation_id)

    # Long-term memory
    ltm = get_long_term_memory(user_id)

    # User location from browser GPS
    lat = state.get("latitude")
    lon = state.get("longitude")
    location_context = None
    if lat is not None and lon is not None:
        location_context = f"User's current GPS coordinates: {lat:.4f}°N, {lon:.4f}°E. Use these for weather lookups and location-aware responses."

    # Build system prompt with all context
    system_prompt = build_system_prompt(
        selected_language=lang,
        summary=summary,
        long_term_memory=ltm,
        location_context=location_context,
    )

    # Compose the full messages list
    messages = [SystemMessage(content=system_prompt)]
    messages.extend(recent_messages)
    messages.append(HumanMessage(content=state["human_input"]))

    return {
        "messages": messages,
        "summary": summary,
        "long_term_memory": ltm,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Node: rag_retrieval
# ─────────────────────────────────────────────────────────────────────────────

async def rag_retrieval(state: AgentState) -> Dict[str, Any]:
    """Retrieve knowledge from Bedrock Knowledge Base and inject into context."""
    if not RAG_AVAILABLE:
        return {}
    
    try:
        return await retrieve_rag_context_async(state)
    except Exception as e:
        import logging
        logging.warning(f"RAG retrieval failed: {e}")
        return {
            "rag_context": None,
            "rag_error": str(e),
            "rag_documents_count": 0,
        }


# ─────────────────────────────────────────────────────────────────────────────
# Mock LLM fallback (when Bedrock is unavailable)
# ─────────────────────────────────────────────────────────────────────────────

_MOCK_RESPONSES_BY_LANG = {
    "en": [
        "Based on current sea conditions near the Konkan coast, today is a good day for fishing! Wind speed is moderate at 3-4 m/s from the northwest. I recommend heading out early morning between 0400-0900 IST for the best catch. Indian Pomfret and Mackerel are in season. 🐟",
        "Namaste! The weather looks favorable for the next 3 days. Sea surface temperature is around 28°C which is ideal for Tuna and Seer Fish. However, please avoid venturing beyond 12 nautical miles as there are reports of rough patches further out. Stay safe! 🌊",
        "Great question! Based on recent market data, Pomfret is fetching ₹750-800/kg at Mumbai's Sassoon Docks. Surmai (Seer Fish) is at ₹700/kg with high demand. I'd suggest selling your Pomfret catch today while prices are up. For Mackerel, prices are stable at ₹200/kg. 💰",
        "The fishing ban period along the west coast (June 1 - July 31) doesn't apply to traditional non-mechanised boats. If you're using a motorised trawler, please ensure your license is current. The PM Matsya Sampada Yojana offers subsidies up to ₹3 lakh for equipment upgrades. Visit your district fisheries office for more details. 📋",
        "For the best catch quality, remember to ice your fish immediately after catching. Maintain a temperature of 0-4°C. Gut larger fish within 2 hours. Premium grade fish can earn you ₹120-200/kg more than Standard grade — that's a big difference over a season! 🧊",
    ],
    "ta": [
        "கொங்கன் கடற்கரைக்கு அருகிலுள்ள தற்போதைய கடல் நிலைமைகளின் அடிப்படையில், இன்று மீன்பிடிக்க ஒரு நல்ல நாள்! காற்றாலை மேற்கு திசையிலிருந்து 3-4 மீ/வி வேகத்தில் மிதமாக உள்ளது. சிறந்த பிடிப்பிற்காக காலை 0400-0900 IST க்கு இடையில் செல்வதற்கு பரிந்துரைக்கிறேன். பாம்ஃப்ரெட் மற்றும் கானாங்கெளுத்தி பருவத்தில் உள்ளன. 🐟",
        "நமஸ்காரம்! அடுத்த 3 நாட்களுக்கு வானிலை சாதகமாக தெரிகிறது. கடல் பரப்பளவு சுமார் 28°C வெப்பநிலையில் உள்ளது, இது சூரை மற்றும் சீலா மீன்களுக்கு ஏற்றது. இருந்தாலும், கடல் கொந்தளிப்பு அதிகமாக உள்ளதால் 12 கடல் மைல்களுக்கு அப்பால் செல்வதைத் தவிர்க்கவும். கவனமாகப் செல்லுங்கள்! 🌊",
        "நல்ல கேள்வி! சமீபத்திய சந்தை தரவுகளின் அடிப்படையில், மும்பையின் சாசூன் டாக்ஸில் பாம்ஃப்ரெட் ₹750-800/கிலோவுக்குச் செல்கிறது. அதிக தேவையுடன் சுறாமீன் (Seer Fish) ₹700/கிலோவில் உள்ளது. பாம்ஃப்ரெட் இன்றைய விலையில் விற்கப் பரிந்துரைக்கிறேன். கானாங்கெளுத்தி விலை ₹200/கிலோவில் நிலையாக உள்ளது. 💰",
        "பழமைவாத படகுகளுக்கு மீன்பிடி தடைக்காலம் (ஜூன் 1 - ஜூலை 31) பொருந்தாது. இயந்திரமயமாக்கப்பட்ட டிராலரை பயன்படுத்தினால், உரிமம் தற்போதையதில் உள்ளதா என்பதை உறுதிப்படுத்தவும். PM மத்ஸ்ய சம்பதா யோஜனா மானியங்களை வழங்குகிறது. 📋",
        "சிறந்த தரத்தை பெற, மீன்பிடித்தவுடன் உடனடியாக பனிக்கட்டியிடவும். 0-4°C வெப்பநிலையை பராமரிக்கவும். பெரிய மீன்களை 2 மணி நேரங்களுக்குள் துண்டிக்கவும். 🧊",
    ]
}

def _get_mock_response(user_input: str, language: str = "en") -> str:
    """Return a contextual mock response based on keywords in the user's message."""
    lower = user_input.lower()
    mock_set = _MOCK_RESPONSES_BY_LANG.get(language, _MOCK_RESPONSES_BY_LANG["en"])

    if any(w in lower for w in ("weather", "wind", "wave", "rain", "storm", "sea condition")):
        return mock_set[1]
    if any(w in lower for w in ("price", "market", "sell", "buy", "rate", "cost")):
        return mock_set[2]
    if any(w in lower for w in ("regulation", "ban", "license", "scheme", "government", "subsidy")):
        return mock_set[3]
    if any(w in lower for w in ("quality", "ice", "fresh", "preserve", "store", "grade")):
        return mock_set[4]

    # Default
    return mock_set[0]


# ─────────────────────────────────────────────────────────────────────────────
# Node: agent
# ─────────────────────────────────────────────────────────────────────────────

async def agent(state: AgentState) -> Dict[str, Any]:
    """Invoke the LLM with the current message history. Falls back to mock if Gemini unavailable."""
    import logging
    import traceback
    lang = state.get("selected_language", "en")
    
    try:
        # Rebuild system prompt with RAG context if available
        messages = list(state["messages"])
        
        if state.get("rag_context"):
            # Rebuild system prompt with RAG context
            system_prompt = build_system_prompt(
                selected_language=lang,
                summary=state.get("summary"),
                long_term_memory=state.get("long_term_memory"),
                region_context=state.get("region_context"),
                catch_context=state.get("catch_context"),
                location_context=None,  # Already in initial system prompt
                rag_context=state.get("rag_context"),
            )
            
            # Replace the first system message
            if messages and isinstance(messages[0], SystemMessage):
                messages[0] = SystemMessage(content=system_prompt)
        
        llm = _get_llm()
        response = await llm.ainvoke(messages)
        logging.debug(f"Gemini response content length: {len(response.content) if response.content else 0}, tool_calls: {len(response.tool_calls) if hasattr(response, 'tool_calls') and response.tool_calls else 0}")
    except Exception as e:
        logging.error(f"LLM call FAILED ({type(e).__name__}: {e})\n{traceback.format_exc()}")
        mock_text = _get_mock_response(state.get("human_input", ""), lang)
        response = AIMessage(content=mock_text)
    return {"messages": state["messages"] + [response]}


# ─────────────────────────────────────────────────────────────────────────────
# Node: tool_executor
# ─────────────────────────────────────────────────────────────────────────────

TOOL_MAP = {t.name: t for t in TOOLS}

async def tool_executor(state: AgentState) -> Dict[str, Any]:
    """Execute any tool calls made by the LLM."""
    messages = list(state["messages"])
    last_msg = messages[-1]

    if not isinstance(last_msg, AIMessage) or not last_msg.tool_calls:
        return {"messages": messages}

    tool_outputs = state.get("tool_outputs", [])

    for call in last_msg.tool_calls:
        tool_name = call["name"]
        tool_args = call["args"]

        # Auto-inject user_id for catch tools so the LLM doesn't need to guess it
        if tool_name in ("get_catch_history", "get_catch_details", "get_group_history", "get_group_details"):
            tool_args["user_id"] = state.get("user_id", "")

        if tool_name in TOOL_MAP:
            try:
                result = await TOOL_MAP[tool_name].ainvoke(tool_args)
            except Exception as e:
                result = f"⚠️ Tool error: {e}"
        else:
            result = f"⚠️ Unknown tool: {tool_name}"

        messages.append(ToolMessage(content=str(result), tool_call_id=call["id"]))
        tool_outputs.append({"tool": tool_name, "args": tool_args, "result": str(result)[:500]})

    return {"messages": messages, "tool_outputs": tool_outputs}


# ─────────────────────────────────────────────────────────────────────────────
# Node: memory_update
# ─────────────────────────────────────────────────────────────────────────────

async def memory_update(state: AgentState) -> Dict[str, Any]:
    """Extract long-term memory from the latest exchange (fire-and-forget)."""
    messages = state["messages"]
    # Find the last AI text response
    ai_response = ""
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and msg.content and not msg.tool_calls:
            content = msg.content
            # Gemini 2.5 may return list of content blocks
            if isinstance(content, list):
                parts = []
                for block in content:
                    if isinstance(block, str):
                        parts.append(block)
                    elif isinstance(block, dict) and block.get("type") == "text":
                        parts.append(block.get("text", ""))
                ai_response = "\n".join(parts)
            else:
                ai_response = str(content)
            break

    if ai_response:
        try:
            await extract_and_update_long_term_memory(
                user_id=state["user_id"],
                user_message=state["human_input"],
                assistant_response=ai_response,
            )
        except Exception:
            pass  # Don't fail the response if memory extraction fails

    return {}


# ─────────────────────────────────────────────────────────────────────────────
# Routing functions
# ─────────────────────────────────────────────────────────────────────────────

def route_language(state: AgentState) -> Literal["load_context", "end"]:
    """After language_guard: if rejected, go to END; else continue."""
    if state.get("language_accepted"):
        return "load_context"
    return "end"


def route_agent(state: AgentState) -> Literal["tool_executor", "memory_update"]:
    """After agent: if tool calls exist, execute them; else update memory and end."""
    messages = state.get("messages", [])
    if messages:
        last = messages[-1]
        if isinstance(last, AIMessage) and last.tool_calls:
            return "tool_executor"
    return "memory_update"


# ─────────────────────────────────────────────────────────────────────────────
# Build the graph
# ─────────────────────────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    """Construct and compile the LangGraph agent graph."""
    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("language_guard", language_guard)
    workflow.add_node("load_context", load_context)
    if RAG_AVAILABLE:
        workflow.add_node("rag_retrieval", rag_retrieval)
    workflow.add_node("agent", agent)
    workflow.add_node("tool_executor", tool_executor)
    workflow.add_node("memory_update", memory_update)

    # Entry point
    workflow.set_entry_point("language_guard")

    # Edges
    workflow.add_conditional_edges("language_guard", route_language, {
        "load_context": "load_context",
        "end": END,
    })
    
    if RAG_AVAILABLE:
        # With RAG: load_context -> rag_retrieval -> agent
        workflow.add_edge("load_context", "rag_retrieval")
        workflow.add_edge("rag_retrieval", "agent")
    else:
        # Without RAG: load_context -> agent
        workflow.add_edge("load_context", "agent")
    
    workflow.add_conditional_edges("agent", route_agent, {
        "tool_executor": "tool_executor",
        "memory_update": "memory_update",
    })
    workflow.add_edge("tool_executor", "agent")      # Loop back after tool execution
    workflow.add_edge("memory_update", END)

    return workflow.compile()


# Singleton graph instance
graph = build_graph()
