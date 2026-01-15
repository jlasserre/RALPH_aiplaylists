'use client';

import { useState } from 'react';
import { Button, Input, TextArea } from '@/components/ui';

type LLMProvider = 'claude' | 'openai';

interface LeftPanelProps {
  /** Callback when New Playlist is clicked */
  onNewPlaylist?: () => void;
  /** Callback when Load Existing is selected */
  onLoadExisting?: (playlistId: string) => void;
  /** Callback when Suggest songs is clicked */
  onSuggestSongs?: (prompt: string, provider: LLMProvider) => void;
  /** Callback when playlist name changes */
  onPlaylistNameChange?: (name: string) => void;
  /** Controlled playlist name value */
  playlistName?: string;
  /** Whether generation is in progress */
  isGenerating?: boolean;
}

const PROMPT_MIN_LENGTH = 10;
const PROMPT_MAX_LENGTH = 5000;

/**
 * Left panel containing playlist controls:
 * - New Playlist / Load Existing buttons
 * - LLM provider selector
 * - Playlist name input
 * - Prompt textarea
 * - Suggest songs button
 */
export function LeftPanel({
  onNewPlaylist,
  onLoadExisting,
  onSuggestSongs,
  onPlaylistNameChange,
  playlistName = '',
  isGenerating = false,
}: LeftPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [llmProvider, setLLMProvider] = useState<LLMProvider>('claude');

  /**
   * Handle New Playlist click - clears prompt and calls parent handler
   */
  const handleNewPlaylist = () => {
    setPrompt('');
    onNewPlaylist?.();
  };

  const handleSuggestSongs = () => {
    if (prompt.length >= PROMPT_MIN_LENGTH) {
      onSuggestSongs?.(prompt, llmProvider);
    }
  };

  const isPromptValid = prompt.length >= PROMPT_MIN_LENGTH;
  const promptError =
    prompt.length > 0 && prompt.length < PROMPT_MIN_LENGTH
      ? `Prompt must be at least ${PROMPT_MIN_LENGTH} characters`
      : undefined;

  return (
    <div className="space-y-6">
      {/* Playlist Actions */}
      <div className="space-y-2">
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          onClick={handleNewPlaylist}
        >
          New Playlist
        </Button>
        <div className="relative">
          <select
            className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-1.5 pr-8 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            onChange={(e) => {
              if (e.target.value) {
                onLoadExisting?.(e.target.value);
                e.target.value = '';
              }
            }}
            defaultValue=""
          >
            <option value="" disabled>
              Load Existing...
            </option>
            {/* Playlist options will be populated by parent component */}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Divider */}
      <hr className="border-gray-200" />

      {/* LLM Provider Selector */}
      <div>
        <label
          htmlFor="llm-provider"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          LLM Provider
        </label>
        <div className="relative">
          <select
            id="llm-provider"
            value={llmProvider}
            onChange={(e) => setLLMProvider(e.target.value as LLMProvider)}
            className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="claude">Claude</option>
            <option value="openai">OpenAI</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Playlist Name */}
      <Input
        label="Playlist Name"
        placeholder="Enter playlist name..."
        value={playlistName}
        onChange={(e) => onPlaylistNameChange?.(e.target.value)}
        maxLength={100}
      />

      {/* Prompt Textarea */}
      <TextArea
        label="Prompt"
        placeholder="Describe the music you want... (e.g., 'upbeat 90s pop songs for a road trip')"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        minLength={PROMPT_MIN_LENGTH}
        maxLength={PROMPT_MAX_LENGTH}
        showCharacterCount
        error={promptError}
        hint={!promptError ? `Minimum ${PROMPT_MIN_LENGTH} characters` : undefined}
        rows={4}
      />

      {/* Suggest Songs Button */}
      <Button
        variant="primary"
        className="w-full"
        onClick={handleSuggestSongs}
        disabled={!isPromptValid || isGenerating}
        isLoading={isGenerating}
      >
        Suggest songs
      </Button>
    </div>
  );
}
