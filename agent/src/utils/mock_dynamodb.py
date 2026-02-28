"""
In-memory mock DynamoDB resource for demo mode.

Implements just enough of the boto3 DynamoDB Table API to support
the patterns used in dynamodb_store.py and catch_history.py.
No real AWS connection needed.
"""
from __future__ import annotations
import copy
from threading import Lock
from typing import Any, Dict, List, Optional


# ── Known table schemas (primary key + sort key) ────────────────────────────

TABLE_SCHEMAS: Dict[str, Dict[str, Optional[str]]] = {
    "ai-bharat-conversations": {"pk": "conversationId", "sk": None},
    "ai-bharat-messages":      {"pk": "conversationId", "sk": "timestamp"},
    "ai-bharat-memory":        {"pk": "userId",         "sk": None},
    "ai-bharat-images":        {"pk": "imageId",        "sk": None},
    "ai-bharat-chats":         {"pk": "chatId",         "sk": None},
    "ai-bharat-users":         {"pk": "userId",         "sk": None},
}

# ── GSI sort keys for ordering ───────────────────────────────────────────────

INDEX_SORT_KEYS: Dict[str, str] = {
    "userId-updatedAt-index":  "updatedAt",
    "userId-createdAt-index":  "createdAt",
    "userId-timestamp-index":  "timestamp",
    "status-createdAt-index":  "createdAt",
    "email-index":             "email",
}

INDEX_PARTITION_KEYS: Dict[str, str] = {
    "userId-updatedAt-index":  "userId",
    "userId-createdAt-index":  "userId",
    "userId-timestamp-index":  "userId",
    "status-createdAt-index":  "status",
    "email-index":             "email",
}


def _extract_condition(condition) -> tuple[str, Any]:
    """
    Extract (field_name, value) from a boto3 Key("field").eq(value) condition.

    This peeks into boto3 internal structures — wrapped in try/except for safety.
    """
    try:
        vals = condition._values
        field_name = vals[0].name
        field_value = vals[1]
        return field_name, field_value
    except (AttributeError, IndexError, TypeError):
        pass

    # Fallback: try string representation parsing
    try:
        s = str(condition)
        # Looks like: "Attr('userId') = Attr('usr_demo_001')" or similar
        if "=" in s:
            parts = s.split("=", 1)
            return parts[0].strip(), parts[1].strip()
    except Exception:
        pass

    return "", ""


class MockBatchWriter:
    """Context manager that delegates to the table's delete_item."""

    def __init__(self, table: "MockTable"):
        self._table = table

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def delete_item(self, Key: Dict[str, Any]):
        self._table.delete_item(Key=Key)


class MockTable:
    """In-memory table supporting put, get, query, update, delete."""

    def __init__(self, name: str):
        self.name = name
        self._items: List[Dict[str, Any]] = []
        self._lock = Lock()
        schema = TABLE_SCHEMAS.get(name, {"pk": "id", "sk": None})
        self._pk = schema["pk"]
        self._sk = schema.get("sk")

        # Automatically seed the database with a demonstration conversation if empty
        if name == "ai-bharat-conversations":
            import time
            now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
            self._items.append({
                "conversationId": "demo_conv_999",
                "userId": "usr_demo_001",
                "title": "Weather & Catch near Malabar",
                "language": "en",
                "messageCount": 2,
                "createdAt": now,
                "updatedAt": now,
            })
        elif name == "ai-bharat-messages":
            import time
            now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
            self._items.extend([
                {
                    "conversationId": "demo_conv_999",
                    "messageId": "msg_999_1",
                    "role": "user",
                    "content": "Is it safe to fish near Malabar coast today?",
                    "timestamp": now.replace(".000Z", ".111Z")
                },
                {
                    "conversationId": "demo_conv_999",
                    "messageId": "msg_999_2",
                    "role": "assistant",
                    "content": "Yes, the current conditions near Malabar are safe with low winds. Happy fishing!",
                    "timestamp": now.replace(".000Z", ".222Z")
                }
            ])
        elif name == "ai-bharat-images":
            import time
            self._items.extend([
                {
                    "imageId": "img_demo_001",
                    "userId": "usr_demo_001",
                    "species": "Pomfret (Paplet)",
                    "confidence": 0.94,
                    "location": "Mumbai, Sassoon Docks",
                    "latitude": 18.9265,
                    "longitude": 72.8312,
                    "weightEstimate": 1.2,
                    "marketPriceEstimate": 800,
                    "qualityGrade": "Premium",
                    "isSustainable": True,
                    "analysisStatus": "completed",
                    "s3Path": "s3://demo/pomfret.jpg",
                    "createdAt": "2026-02-25T08:30:00.000Z",
                },
                {
                    "imageId": "img_demo_002",
                    "userId": "usr_demo_001",
                    "species": "Surmai (Seer Fish)",
                    "confidence": 0.88,
                    "location": "Mumbai, Versova Jetty",
                    "latitude": 19.1347,
                    "longitude": 72.8120,
                    "weightEstimate": 3.5,
                    "marketPriceEstimate": 700,
                    "qualityGrade": "A",
                    "isSustainable": True,
                    "analysisStatus": "completed",
                    "s3Path": "s3://demo/surmai.jpg",
                    "createdAt": "2026-02-26T07:15:00.000Z",
                },
                {
                    "imageId": "img_demo_003",
                    "userId": "usr_demo_001",
                    "species": "Mackerel (Bangda)",
                    "confidence": 0.91,
                    "location": "Mumbai, Versova Jetty",
                    "latitude": 19.1347,
                    "longitude": 72.8120,
                    "weightEstimate": 0.8,
                    "marketPriceEstimate": 200,
                    "qualityGrade": "A",
                    "isSustainable": True,
                    "analysisStatus": "completed",
                    "s3Path": "s3://demo/mackerel.jpg",
                    "createdAt": "2026-02-27T06:45:00.000Z",
                },
                {
                    "imageId": "img_demo_004",
                    "userId": "usr_demo_001",
                    "species": "Rawas (Indian Salmon)",
                    "confidence": 0.86,
                    "location": "Goa, Panaji Fish Market",
                    "latitude": 15.4909,
                    "longitude": 73.8278,
                    "weightEstimate": 2.1,
                    "marketPriceEstimate": 600,
                    "qualityGrade": "Premium",
                    "isSustainable": True,
                    "analysisStatus": "completed",
                    "s3Path": "s3://demo/rawas.jpg",
                    "createdAt": "2026-02-28T05:00:00.000Z",
                },
                {
                    "imageId": "img_demo_005",
                    "userId": "usr_demo_001",
                    "species": "Prawns (Jhinga)",
                    "confidence": 0.92,
                    "location": "Mumbai, Sassoon Docks",
                    "latitude": 18.9265,
                    "longitude": 72.8312,
                    "weightEstimate": 0.5,
                    "marketPriceEstimate": 500,
                    "qualityGrade": "A",
                    "isSustainable": False,
                    "analysisStatus": "completed",
                    "s3Path": "s3://demo/prawns.jpg",
                    "createdAt": "2026-02-28T09:00:00.000Z",
                },
            ])

    # ── Write ────────────────────────────────────────────────────────────────

    def put_item(self, Item: Dict[str, Any]):
        with self._lock:
            key_fields = [self._pk] + ([self._sk] if self._sk else [])
            self._items = [
                i for i in self._items
                if not all(i.get(f) == Item.get(f) for f in key_fields)
            ]
            self._items.append(copy.deepcopy(Item))

    # ── Read ─────────────────────────────────────────────────────────────────

    def get_item(self, Key: Dict[str, Any]):
        with self._lock:
            for item in self._items:
                if all(item.get(k) == v for k, v in Key.items()):
                    return {"Item": copy.deepcopy(item)}
            return {}

    # ── Delete ───────────────────────────────────────────────────────────────

    def delete_item(self, Key: Dict[str, Any]):
        with self._lock:
            self._items = [
                i for i in self._items
                if not all(i.get(k) == v for k, v in Key.items())
            ]

    # ── Query ────────────────────────────────────────────────────────────────

    def query(self, **kwargs) -> Dict[str, Any]:
        with self._lock:
            key_condition = kwargs.get("KeyConditionExpression")
            index_name = kwargs.get("IndexName")
            ascending = kwargs.get("ScanIndexForward", True)
            limit = kwargs.get("Limit")
            select = kwargs.get("Select")

            # Extract partition key filter
            pk_field, pk_value = _extract_condition(key_condition)

            # If we have an index, use the index's partition key
            if index_name and index_name in INDEX_PARTITION_KEYS:
                pk_field = INDEX_PARTITION_KEYS[index_name]

            # Filter items
            matched = [
                i for i in self._items
                if str(i.get(pk_field, "")) == str(pk_value)
            ]

            # Determine sort key
            sort_key = None
            if index_name and index_name in INDEX_SORT_KEYS:
                sort_key = INDEX_SORT_KEYS[index_name]
            elif self._sk:
                sort_key = self._sk

            if sort_key:
                matched.sort(
                    key=lambda x: str(x.get(sort_key, "")),
                    reverse=not ascending,
                )

            if select == "COUNT":
                return {"Count": len(matched), "Items": []}

            if limit:
                matched = matched[:limit]

            return {"Items": [copy.deepcopy(i) for i in matched], "Count": len(matched)}

    # ── Update ───────────────────────────────────────────────────────────────

    def update_item(
        self,
        Key: Dict[str, Any],
        UpdateExpression: str = "",
        ExpressionAttributeNames: Optional[Dict[str, str]] = None,
        ExpressionAttributeValues: Optional[Dict[str, Any]] = None,
    ):
        with self._lock:
            names = ExpressionAttributeNames or {}
            values = ExpressionAttributeValues or {}

            for item in self._items:
                if all(item.get(k) == v for k, v in Key.items()):
                    # Parse "SET #field1 = :val1, #field2 = :val2"
                    set_part = UpdateExpression
                    if set_part.upper().startswith("SET "):
                        set_part = set_part[4:]
                    assignments = [a.strip() for a in set_part.split(",")]
                    for assignment in assignments:
                        lhs, rhs = [s.strip() for s in assignment.split("=", 1)]
                        field = names.get(lhs, lhs)
                        value = values.get(rhs, rhs)
                        item[field] = value
                    return

    # ── Batch writer ─────────────────────────────────────────────────────────

    def batch_writer(self):
        return MockBatchWriter(self)


class MockDynamoDBResource:
    """Drop-in replacement for boto3.resource('dynamodb')."""

    def __init__(self):
        self._tables: Dict[str, MockTable] = {}

    def Table(self, name: str) -> MockTable:
        if name not in self._tables:
            self._tables[name] = MockTable(name)
        return self._tables[name]
