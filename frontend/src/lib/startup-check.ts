/**
 * Development-mode startup diagnostics for OceanAI Frontend.
 * Validates required environment variables and probes backend/agent reachability.
 * Only runs on the client side in non-production mode.
 */

interface CheckResult {
    name: string;
    status: 'ok' | 'warn' | 'critical';
    value?: string;
    message?: string;
}

const ENV_CHECKS: { name: string; key: string; level: 'critical' | 'warn'; desc: string }[] = [
    { name: 'NEXT_PUBLIC_API_URL', key: 'NEXT_PUBLIC_API_URL', level: 'critical', desc: 'Backend API URL' },
    { name: 'NEXT_PUBLIC_AGENT_URL', key: 'NEXT_PUBLIC_AGENT_URL', level: 'critical', desc: 'Agent API URL' },
    { name: 'NEXT_PUBLIC_ML_BASE_URL', key: 'NEXT_PUBLIC_ML_BASE_URL', level: 'warn', desc: 'ML API base URL' },
    { name: 'NEXT_PUBLIC_COGNITO_USER_POOL_ID', key: 'NEXT_PUBLIC_COGNITO_USER_POOL_ID', level: 'warn', desc: 'Cognito User Pool ID' },
    { name: 'NEXT_PUBLIC_COGNITO_CLIENT_ID', key: 'NEXT_PUBLIC_COGNITO_CLIENT_ID', level: 'warn', desc: 'Cognito Client ID' },
    { name: 'NEXT_PUBLIC_COGNITO_REGION', key: 'NEXT_PUBLIC_COGNITO_REGION', level: 'warn', desc: 'Cognito region' },
    { name: 'NEXT_PUBLIC_OPENWEATHERMAP_API_KEY', key: 'NEXT_PUBLIC_OPENWEATHERMAP_API_KEY', level: 'warn', desc: 'OpenWeatherMap API key' },
];

const ENV_MAP: Record<string, string | undefined> = {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_AGENT_URL: process.env.NEXT_PUBLIC_AGENT_URL,
    NEXT_PUBLIC_ML_BASE_URL: process.env.NEXT_PUBLIC_ML_BASE_URL,
    NEXT_PUBLIC_COGNITO_USER_POOL_ID: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
    NEXT_PUBLIC_COGNITO_CLIENT_ID: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
    NEXT_PUBLIC_COGNITO_REGION: process.env.NEXT_PUBLIC_COGNITO_REGION,
    NEXT_PUBLIC_OPENWEATHERMAP_API_KEY: process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY,
};

export async function runStartupChecks(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'production') return;

    const results: CheckResult[] = [];
    let criticalErrors = 0;
    let warnings = 0;

    // ── 1. Environment Variables ─────────────────────────────────────────────
    for (const { name, key, level, desc } of ENV_CHECKS) {
        const value = ENV_MAP[key];
        if (value) {
            results.push({ name, status: 'ok', value });
        } else if (level === 'critical') {
            results.push({ name, status: 'critical', message: `MISSING — ${desc}` });
            criticalErrors++;
        } else {
            results.push({ name, status: 'warn', message: `not set — ${desc}` });
            warnings++;
        }
    }

    // ── 2. Connectivity Probes ──────────────────────────────────────────────
    const apiUrl = ENV_MAP.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const res = await fetch(`${apiUrl}/health`, { signal: controller.signal }).catch(() => null);
            clearTimeout(timeout);
            if (res && res.ok) {
                results.push({ name: 'Backend API', status: 'ok', value: `${apiUrl} (healthy)` });
            } else {
                // Try root endpoint as fallback
                const res2 = await fetch(apiUrl, { signal: AbortSignal.timeout(3000) }).catch(() => null);
                if (res2) {
                    results.push({ name: 'Backend API', status: 'ok', value: `${apiUrl} (reachable, status ${res2.status})` });
                } else {
                    results.push({ name: 'Backend API', status: 'critical', message: `${apiUrl} — unreachable` });
                    criticalErrors++;
                }
            }
        } catch {
            results.push({ name: 'Backend API', status: 'critical', message: `${apiUrl} — unreachable` });
            criticalErrors++;
        }
    }

    const agentUrl = ENV_MAP.NEXT_PUBLIC_AGENT_URL;
    if (agentUrl) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const res = await fetch(`${agentUrl}/health`, { signal: controller.signal });
            clearTimeout(timeout);
            if (res.ok) {
                results.push({ name: 'Agent API', status: 'ok', value: `${agentUrl} (healthy)` });
            } else {
                results.push({ name: 'Agent API', status: 'warn', message: `${agentUrl} (status ${res.status})` });
                warnings++;
            }
        } catch {
            results.push({ name: 'Agent API', status: 'warn', message: `${agentUrl} — unreachable` });
            warnings++;
        }
    }

    // ── 3. Console Output ───────────────────────────────────────────────────
    const icon = (status: string) =>
        status === 'ok' ? '✅' : status === 'warn' ? '⚠️' : '❌';

    const style = (status: string) =>
        status === 'ok'
            ? 'color: #22c55e; font-weight: bold;'
            : status === 'warn'
                ? 'color: #eab308; font-weight: bold;'
                : 'color: #ef4444; font-weight: bold;';

    console.group(
        '%c🐟 OceanAI Frontend — Startup Diagnostics',
        'color: #06b6d4; font-weight: bold; font-size: 14px; padding: 4px 0;'
    );

    console.group('%cEnvironment & Connectivity', 'color: #94a3b8; font-weight: bold;');
    for (const r of results) {
        const displayValue = r.value || r.message || '';
        console.log(
            `%c${icon(r.status)} ${r.name}%c  ${displayValue}`,
            style(r.status),
            'color: #64748b;'
        );
    }
    console.groupEnd();

    // Summary
    if (criticalErrors > 0) {
        console.log(
            `%c❌ ${criticalErrors} critical error(s), ${warnings} warning(s)`,
            'color: #ef4444; font-weight: bold; font-size: 12px; padding: 4px 0;'
        );
    } else if (warnings > 0) {
        console.log(
            `%c⚠️ ${warnings} warning(s), 0 critical errors`,
            'color: #eab308; font-weight: bold; font-size: 12px; padding: 4px 0;'
        );
    } else {
        console.log(
            '%c✅ All checks passed!',
            'color: #22c55e; font-weight: bold; font-size: 12px; padding: 4px 0;'
        );
    }

    console.groupEnd();
}

// Auto-run on module load (client-side, dev mode only)
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    // Delay slightly to let the page settle before firing diagnostics
    setTimeout(() => runStartupChecks(), 1500);
}
