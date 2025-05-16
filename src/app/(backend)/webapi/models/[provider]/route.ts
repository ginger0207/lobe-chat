import {
  AGENT_RUNTIME_ERROR_SET,
  ChatCompletionErrorPayload,
  ModelRuntime,
} from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';
import { ModelProvider } from 'model-bank';
import { NextResponse } from 'next/server';

import { checkAuth } from '@/app/(backend)/middleware/auth';
import { initModelRuntimeWithUserPayload } from '@/server/modules/ModelRuntime';
import { createErrorResponse } from '@/utils/errorResponse';

const noNeedAPIKey = (provider: string) => [ModelProvider.OpenRouter].includes(provider as any);

export const GET = checkAuth(async (req, { params, jwtPayload, createRuntime }) => {
  const { provider } = await params;

  try {
    // ============  1. init model runtime   ============ //
    let agentRuntime: ModelRuntime;
    if (createRuntime) {
      agentRuntime = createRuntime(jwtPayload);
    } else {
      const hasDefaultApiKey = jwtPayload.apiKey || 'dont-need-api-key-for-model-list';
      agentRuntime = await initModelRuntimeWithUserPayload(provider, {
        ...jwtPayload,
        apiKey: noNeedAPIKey(provider) ? hasDefaultApiKey : jwtPayload.apiKey,
      });
    }

    // ============  2. fetch models list   ============ //
    const list = await agentRuntime.models();

    return NextResponse.json(list);
  } catch (e) {
    const {
      errorType = ChatErrorType.InternalServerError,
      error: errorContent,
      ...res
    } = e as ChatCompletionErrorPayload;

    const error = errorContent || e;

    const logMethod = AGENT_RUNTIME_ERROR_SET.has(errorType as string) ? 'warn' : 'error';
    // track the error at server side
    console[logMethod](`Route: [${provider}] ${errorType}:`, error);

    return createErrorResponse(errorType, { error, ...res, provider });
  }
});
