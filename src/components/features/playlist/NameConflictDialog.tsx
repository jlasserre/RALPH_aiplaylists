'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';

export type ConflictResolution =
  | { type: 'add-to-existing'; playlistId: string }
  | { type: 'replace-contents'; playlistId: string }
  | { type: 'use-different-name'; newName: string }
  | { type: 'cancel' };

interface NameConflictDialogProps {
  conflictingPlaylistName: string;
  conflictingPlaylistId: string;
  isOpen: boolean;
  onResolve: (resolution: ConflictResolution) => void;
}

/**
 * Dialog shown when user tries to create a playlist with a name that already exists.
 * Offers three options: add to existing, replace contents, or use a different name.
 */
export function NameConflictDialog({
  conflictingPlaylistName,
  conflictingPlaylistId,
  isOpen,
  onResolve,
}: NameConflictDialogProps) {
  const [newName, setNewName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  if (!isOpen) return null;

  const handleAddToExisting = () => {
    onResolve({ type: 'add-to-existing', playlistId: conflictingPlaylistId });
  };

  const handleReplaceContents = () => {
    onResolve({ type: 'replace-contents', playlistId: conflictingPlaylistId });
  };

  const handleUseDifferentName = () => {
    if (showNameInput) {
      const trimmedName = newName.trim();
      if (trimmedName && trimmedName !== conflictingPlaylistName) {
        onResolve({ type: 'use-different-name', newName: trimmedName });
      }
    } else {
      setShowNameInput(true);
    }
  };

  const handleCancel = () => {
    setShowNameInput(false);
    setNewName('');
    onResolve({ type: 'cancel' });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2
          id="conflict-dialog-title"
          className="text-lg font-semibold text-gray-900 mb-2"
        >
          Playlist Name Exists
        </h2>

        <p className="text-gray-600 mb-6">
          A playlist named &quot;{conflictingPlaylistName}&quot; already exists.
          What would you like to do?
        </p>

        <div className="space-y-3">
          {!showNameInput ? (
            <>
              <button
                onClick={handleAddToExisting}
                className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900">Add new songs to it</div>
                <div className="text-sm text-gray-500">
                  Keep existing songs and add your new selections
                </div>
              </button>

              <button
                onClick={handleReplaceContents}
                className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900">Replace its current contents</div>
                <div className="text-sm text-gray-500">
                  Remove all existing songs and add only your new selections
                </div>
              </button>

              <button
                onClick={handleUseDifferentName}
                className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900">Create a new playlist with a different name</div>
                <div className="text-sm text-gray-500">
                  Choose a new name for your playlist
                </div>
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <Input
                label="New playlist name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter a new name"
                maxLength={100}
                autoFocus
              />
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowNameInput(false);
                    setNewName('');
                  }}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={handleUseDifferentName}
                  disabled={!newName.trim() || newName.trim() === conflictingPlaylistName}
                  className="flex-1"
                >
                  Create
                </Button>
              </div>
            </div>
          )}
        </div>

        {!showNameInput && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <Button
              variant="ghost"
              onClick={handleCancel}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
