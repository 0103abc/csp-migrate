"use strict";

const DEFAULT_PERSONA =
  "你是米格瑞特（Migrate），一位与海洋和海鸟为伴的成年旅人、航海法杖的主人，也是用户的桌面伙伴。你温柔、机灵、有自己的主见，偶尔用海风、潮汐、航行做自然的比喻。通常回应两到四句，用户需要时可以详细解释。不要在每句话中堆砌航海意象，不要自称语言模型，不要声称能访问你没有的电脑功能，不要编造已经执行了电脑操作。";
const DEFAULTS = Object.freeze({
  shortcut: "Ctrl+Alt+M",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-flash",
  locale: "zh-CN",
  size: 1,
  autoActions: true,
  idleInterval: 90,
  alwaysOnTop: true,
  launchAtLogin: false,
  persona: DEFAULT_PERSONA,
  position: null,
  encryptedKey: "",
});

function apiEndpoint(input) {
  let url;
  try {
    url = new URL(String(input).trim());
  } catch {
    throw new Error("请输入有效的 API 地址。");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "API 地址必须使用 HTTPS（本机测试可使用 HTTP），且不能包含账号、参数或片段。",
    );
  }
  url.pathname =
    url.pathname.replace(/\/+$/, "").replace(/\/chat\/completions$/, "") +
    "/chat/completions";
  return url.toString();
}

function validateSettings(raw, previous = DEFAULTS) {
  if (!raw || typeof raw !== "object") throw new Error("设置格式不正确。");
  const next = { ...previous };
  if ("locale" in raw) {
    if (!["zh-CN", "zh-HK"].includes(raw.locale))
      throw new Error("请选择简体中文或繁體中文（香港）。");
    next.locale = raw.locale;
  }
  if ("idleInterval" in raw) {
    const interval = Number(raw.idleInterval);
    if (![45, 90, 180, 300].includes(interval))
      throw new Error("请选择有效的自动动作间隔。");
    next.idleInterval = interval;
  }
  for (const key of ["autoActions", "alwaysOnTop", "launchAtLogin"]) {
    if (key in raw) {
      if (typeof raw[key] !== "boolean")
        throw new Error("开关设置格式不正确。");
      next[key] = raw[key];
    }
  }
  if ("size" in raw) {
    const value = Number(raw.size);
    if (!Number.isFinite(value) || value < 0.7 || value > 1.5)
      throw new Error("桌宠大小应为 70% 到 150%。");
    next.size = value;
  }
  if ("shortcut" in raw) {
    const value = String(raw.shortcut).trim();
    if (
      !/^(?:(?:Ctrl|Control|Alt|Shift|Super|CommandOrControl)\+){1,3}(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space)$/i.test(
        value,
      )
    ) {
      throw new Error("快捷键格式示例：Ctrl+Alt+M 或 Ctrl+Shift+F8。");
    }
    next.shortcut = value;
  }
  if ("baseUrl" in raw) {
    apiEndpoint(raw.baseUrl);
    next.baseUrl = String(raw.baseUrl)
      .trim()
      .replace(/\/+$/, "")
      .replace(/\/chat\/completions$/, "");
  }
  if ("model" in raw) {
    const value = String(raw.model).trim();
    if (!/^[a-zA-Z0-9._:/-]{1,100}$/.test(value))
      throw new Error("请输入有效的模型名称。");
    next.model = value;
  }
  if ("persona" in raw) {
    const value = String(raw.persona).trim();
    if (!value || value.length > 8000)
      throw new Error("角色设定应为 1 到 8000 个字符。");
    next.persona = value;
  }
  return next;
}

function clampBounds(bounds, area) {
  const width = Math.min(Math.max(1, Math.round(bounds.width)), area.width);
  const height = Math.min(Math.max(1, Math.round(bounds.height)), area.height);
  return {
    x: Math.round(
      Math.max(
        area.x,
        Math.min(
          Number.isFinite(bounds.x) ? bounds.x : area.x,
          area.x + area.width - width,
        ),
      ),
    ),
    y: Math.round(
      Math.max(
        area.y,
        Math.min(
          Number.isFinite(bounds.y) ? bounds.y : area.y,
          area.y + area.height - height,
        ),
      ),
    ),
    width,
    height,
  };
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) throw new Error("对话格式不正确。");
  const cleaned = messages.slice(-24).map((m) => {
    if (
      !m ||
      !["user", "assistant"].includes(m.role) ||
      typeof m.content !== "string" ||
      !m.content.trim() ||
      m.content.length > 8000
    )
      throw new Error("消息为空或超过 8000 字。");
    return { role: m.role, content: m.content };
  });
  if (!cleaned.length || cleaned.at(-1).role !== "user")
    throw new Error("请先输入消息。");
  let length = 0;
  for (let i = cleaned.length - 1; i >= 0; i--) {
    length += cleaned[i].content.length;
    if (length > 48000) return cleaned.slice(i + 1);
  }
  return cleaned;
}

// SSE may split inside UTF-8 characters, JSON, CRLF, or the final event.
async function consumeSSE(stream, onDelta, signal) {
  const decoder = new TextDecoder();
  let buffer = "",
    data = [],
    done = false,
    content = "",
    finishReason = null;
  function dispatch() {
    if (!data.length) return;
    const payload = data.join("\n");
    data = [];
    if (payload.trim() === "[DONE]") {
      done = true;
      return;
    }
    let chunk;
    try {
      chunk = JSON.parse(payload);
    } catch {
      throw new Error("API 返回了无法解析的流式数据。");
    }
    if (chunk.error)
      throw new Error("API 返回错误，请检查模型、密钥与服务状态。");
    const choice = chunk.choices?.[0];
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    const delta = choice?.delta?.content;
    if (typeof delta === "string" && delta) {
      content += delta;
      onDelta(delta);
    }
  }
  function line(value) {
    if (value.endsWith("\r")) value = value.slice(0, -1);
    if (value === "") dispatch();
    else if (value.startsWith("data:"))
      data.push(value.slice(5).replace(/^ /, ""));
  }
  for await (const bytes of stream) {
    if (signal?.aborted) throw new DOMException("已停止", "AbortError");
    buffer += decoder.decode(bytes, { stream: true });
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      line(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      if (done) return { content, finishReason };
    }
    if (buffer.length > 1024 * 1024) throw new Error("API 流式数据过长。");
  }
  buffer += decoder.decode();
  if (buffer) line(buffer);
  dispatch();
  if (!done && !finishReason) throw new Error("连接意外中断，请重试。");
  return { content, finishReason };
}

function httpError(status) {
  if (status === 401 || status === 403)
    return "密钥无效或没有访问权限，请在设置中检查 API Key。";
  if (status === 402) return "DeepSeek 余额不足，请检查账户余额。";
  if (status === 429) return "请求太频繁，请稍后再试。";
  if (status === 400 || status === 404 || status === 422)
    return `API 地址、模型名称或请求不受支持（HTTP ${status}）。`;
  return `服务暂时不可用（HTTP ${status}），请稍后重试。`;
}

async function requestChat({
  settings,
  apiKey,
  messages,
  onDelta,
  signal,
  fetcher = fetch,
}) {
  if (!apiKey) throw new Error("请先在「设置 → DeepSeek」中填写 API Key。");
  const endpoint = apiEndpoint(settings.baseUrl);
  const timeout = AbortSignal.timeout(120000);
  const response = await fetcher(endpoint, {
    method: "POST",
    redirect: "error",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        {
          role: "system",
          content:
            settings.persona +
            (settings.locale === "zh-HK"
              ? "\n語言要求：請使用繁體中文（香港）及香港常見用語回答。保持自然的書面中文，不必強行使用粵語口語。"
              : "\n语言要求：请使用简体中文回答。"),
        },
        ...cleanMessages(messages),
      ],
      stream: true,
      max_tokens: 2048,
    }),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(httpError(response.status));
  }
  if (!response.body) throw new Error("API 没有返回内容。");
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    const value = await response.json();
    const content = value.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim())
      throw new Error("API 返回了空回复。");
    onDelta(content);
    return { content, finishReason: value.choices[0].finish_reason };
  }
  const result = await consumeSSE(response.body, onDelta, signal);
  if (!result.content.trim())
    throw new Error("API 返回了空回复，请检查模型设置。");
  return result;
}

module.exports = {
  DEFAULTS,
  DEFAULT_PERSONA,
  validateSettings,
  apiEndpoint,
  clampBounds,
  cleanMessages,
  consumeSSE,
  requestChat,
  httpError,
};
