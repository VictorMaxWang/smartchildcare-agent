export interface AsrProviderInput {
  attachmentName?: string;
  fallbackText?: string;
}

export interface AsrProviderOutput {
  transcript: string;
}

export interface AsrProviderResult<T> {
  provider: string;
  mode: "mock" | "real";
  output: T;
}

export interface AsrProvider {
  transcribe(input: AsrProviderInput): Promise<AsrProviderResult<AsrProviderOutput>>;
}

function buildMockTranscript(input: AsrProviderInput) {
  if (input.fallbackText?.trim()) return input.fallbackText.trim();
  return `${input.attachmentName ?? "语音速记"} 转写结果：孩子今天晨检后情绪偏低，午睡前需要再看一次体温和饮水。`;
}

class MockAsrProvider implements AsrProvider {
  async transcribe(input: AsrProviderInput) {
    return {
      provider: "mock-asr",
      mode: "mock" as const,
      output: {
        transcript: buildMockTranscript(input),
      },
    };
  }
}

class RealPlaceholderAsrProvider implements AsrProvider {
  async transcribe(input: AsrProviderInput) {
    return {
      provider: process.env.ASR_PROVIDER_NAME || "real-asr-placeholder",
      mode: "real" as const,
      output: {
        transcript: buildMockTranscript(input),
      },
    };
  }
}

export function resolveAsrProvider(): AsrProvider {
  // Future: replace this provider with vivo 蓝心 ASR capability when credentials are available.
  return process.env.ASR_PROVIDER_API_KEY ? new RealPlaceholderAsrProvider() : new MockAsrProvider();
}
