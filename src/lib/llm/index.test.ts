/**
 * Tests for LLM factory module
 */

import { getLLMClient, getDefaultProvider, LLMProvider, LLMClient } from './index';
import { ClaudeClient } from './claude';
import { OpenAIClient } from './openai';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn(),
      },
    })),
  };
});

// Mock the OpenAI SDK
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    })),
  };
});

describe('getLLMClient', () => {
  describe('provider selection', () => {
    it('returns ClaudeClient when provider is "claude"', () => {
      const client = getLLMClient('claude');
      expect(client).toBeInstanceOf(ClaudeClient);
    });

    it('returns OpenAIClient when provider is "openai"', () => {
      const client = getLLMClient('openai');
      expect(client).toBeInstanceOf(OpenAIClient);
    });

    it('throws error for invalid provider', () => {
      // @ts-expect-error Testing invalid provider at runtime
      expect(() => getLLMClient('invalid')).toThrow('Invalid LLM provider: invalid');
    });
  });

  describe('returned client interface', () => {
    const providers: LLMProvider[] = ['claude', 'openai'];

    providers.forEach((provider) => {
      describe(`${provider} client`, () => {
        let client: LLMClient;

        beforeEach(() => {
          client = getLLMClient(provider);
        });

        it('has generateSongs method', () => {
          expect(typeof client.generateSongs).toBe('function');
        });

        it('has generatePlaylistName method', () => {
          expect(typeof client.generatePlaylistName).toBe('function');
        });
      });
    });
  });

  describe('multiple client instantiation', () => {
    it('creates new instances for each call', () => {
      const client1 = getLLMClient('claude');
      const client2 = getLLMClient('claude');
      expect(client1).not.toBe(client2);
    });

    it('can create different provider clients', () => {
      const claudeClient = getLLMClient('claude');
      const openaiClient = getLLMClient('openai');

      expect(claudeClient).toBeInstanceOf(ClaudeClient);
      expect(openaiClient).toBeInstanceOf(OpenAIClient);
    });
  });
});

describe('getDefaultProvider', () => {
  const originalEnv = process.env.LLM_DEFAULT_PROVIDER;

  afterEach(() => {
    // Restore original environment variable
    if (originalEnv !== undefined) {
      process.env.LLM_DEFAULT_PROVIDER = originalEnv;
    } else {
      delete process.env.LLM_DEFAULT_PROVIDER;
    }
  });

  it('returns "claude" when LLM_DEFAULT_PROVIDER is "claude"', () => {
    process.env.LLM_DEFAULT_PROVIDER = 'claude';
    expect(getDefaultProvider()).toBe('claude');
  });

  it('returns "openai" when LLM_DEFAULT_PROVIDER is "openai"', () => {
    process.env.LLM_DEFAULT_PROVIDER = 'openai';
    expect(getDefaultProvider()).toBe('openai');
  });

  it('returns "claude" as default when LLM_DEFAULT_PROVIDER is not set', () => {
    delete process.env.LLM_DEFAULT_PROVIDER;
    expect(getDefaultProvider()).toBe('claude');
  });

  it('returns "claude" as default when LLM_DEFAULT_PROVIDER is invalid', () => {
    process.env.LLM_DEFAULT_PROVIDER = 'invalid-provider';
    expect(getDefaultProvider()).toBe('claude');
  });

  it('returns "claude" as default when LLM_DEFAULT_PROVIDER is empty string', () => {
    process.env.LLM_DEFAULT_PROVIDER = '';
    expect(getDefaultProvider()).toBe('claude');
  });
});

describe('LLMProvider type', () => {
  it('allows "claude" value', () => {
    const provider: LLMProvider = 'claude';
    expect(provider).toBe('claude');
  });

  it('allows "openai" value', () => {
    const provider: LLMProvider = 'openai';
    expect(provider).toBe('openai');
  });
});

describe('module exports', () => {
  it('exports getLLMClient function', async () => {
    const module = await import('./index');
    expect(typeof module.getLLMClient).toBe('function');
  });

  it('exports getDefaultProvider function', async () => {
    const module = await import('./index');
    expect(typeof module.getDefaultProvider).toBe('function');
  });

  it('exports ClaudeClient class', async () => {
    const module = await import('./index');
    expect(module.ClaudeClient).toBeDefined();
  });

  it('exports OpenAIClient class', async () => {
    const module = await import('./index');
    expect(module.OpenAIClient).toBeDefined();
  });

  it('exports ClaudeAPIError class', async () => {
    const module = await import('./index');
    expect(module.ClaudeAPIError).toBeDefined();
  });

  it('exports OpenAIAPIError class', async () => {
    const module = await import('./index');
    expect(module.OpenAIAPIError).toBeDefined();
  });

  it('exports LLMGenerationConfig type and defaults', async () => {
    const module = await import('./index');
    expect(module.DEFAULT_SONG_GENERATION_CONFIG).toBeDefined();
    expect(module.DEFAULT_PLAYLIST_NAME_CONFIG).toBeDefined();
  });
});
