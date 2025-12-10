# `+page.svelte` Documentation

This document outlines the variables, types, and functions defined in the Svelte component in `+page.svelte`.

## Script Section (`<script lang="ts">`)

### State Variables and Constants

- **`selectedFile`**: `File | null`
  - Stores the currently selected file object for upload.
- **`previewUrl`**: `string | null`
  - Holds the object URL for the preview of the currently selected image.
- **`retainedPreviewUrl`**: `string | null`
  - Holds a previous `previewUrl` to display after an upload is complete.
- **`isDragOver`**: `boolean`
  - Flag to indicate if a file is being dragged over the drop zone.
- **`dragDepth`**: `number`
  - Counter to manage nested drag enter/leave events.
- **`resultText`**: `string`
  - Displays the status or result of the OCR process.
- **`isLoggedIn`**: `boolean`
  - Tracks user's authentication status.
- **`uploading`**: `boolean`
  - Flag to indicate if an upload is in progress.
- **`uploadError`**: `string`
  - Stores any error message related to the upload process.
- **`uploadResult`**: `UploadCard | null`
  - Stores the complete response object for the most recent successful upload.
- **`recentUploads`**: `UploadCard[]`
  - An array of recent upload result objects.
- **`showAdvanced`**: `boolean`
  - Controls the visibility of the advanced OCR options panel.
- **`autoLanguageDetection`**: `boolean`
  - Determines if the OCR should automatically detect the language.
- **`languageHint`**: `string`
  - Stores the user-provided language hint (e.g., 'en', 'fr').
- **`outputFormat`**: `'raw' | 'paragraph'`
  - The desired format for the extracted text.
- **`ocrMode`**: `'fast' | 'high_accuracy'`
  - The mode for the OCR engine, balancing speed and accuracy.
- **`chatMessages`**: `ChatMessage[]`
  - An array of messages in the chat interface.
- **`chatInput`**: `string`
  - The current value of the chat input field.
- **`chatSending`**: `boolean`
  - Flag to indicate if a chat message is being sent.
- **`chatError`**:`string`
  - Stores any error message related to the chat functionality.
- **`activeUploadSocket`**: `WebSocket | null`
  - Holds the currently active WebSocket connection.
- **`pendingQuestionResolve`**: `((answer: string) => void) | null`
  - Stores the `resolve` function for the promise awaiting a question's answer.
- **`pendingQuestionReject`**: `((error: Error) => void) | null`
  - Stores the `reject` function for the promise awaiting a question's answer.
- **`pendingQuestionTimeout`**: `ReturnType<typeof setTimeout> | null`
  - The timeout ID for a pending question.
- **`WEBSOCKET_TIMEOUT_MS`**: `number`
  - Constant for the WebSocket connection timeout in milliseconds.
- **`QUESTION_TIMEOUT_MS`**: `number`
  - Constant for the question/answer timeout in milliseconds.
- **`uploadedImageEndpoint`**: `string`
  - A derived store that computes the absolute URL of the uploaded image.

### Type Definitions

- **`FollowupQAEntry`**: `{ role: string; content: string }`
  - A single entry in a follow-up Q&A session.
- **`UploadResponse`**: A complex object representing the data returned from the server for an upload.
- **`UploadCard`**: `UploadResponse & { previewObjectUrl?: string | null }`
  - An `UploadResponse` augmented with a local preview URL.
- **`UploadSocketMessage`**: A complex object representing a message received from the WebSocket.
- **`UploadWebsocketRequest`**: The shape of the initial metadata sent to the WebSocket.
- **`ChatMessageRole`**: `'user' | 'assistant' | 'system'`
  - The role of a participant in the chat.
- **`ChatMessage`**: `{ id: string; role: ChatMessageRole; text: string }`
  - Represents a single message in the chat.

### Functions

#### Lifecycle
- **`onMount`**: Svelte lifecycle function. Checks `localStorage` to set the initial `isLoggedIn` state.
- **`onDestroy`**: Svelte lifecycle function. Cleans up object URLs, WebSockets, and other resources.

#### File and Preview Management
- **`revokePreview()`**: Revokes the `previewUrl` to free memory.
- **`revokeRetainedPreview()`**: Revokes the `retainedPreviewUrl` to free memory.
- **`handleFileChange(event: Event)`**: Event handler for the file input. Sets the selected file and resets state.
- **`setSelectedFile(file: File | null)`**: Updates the `selectedFile` state and creates a new `previewUrl`.
- **`clearSelectedFile(options)`**: Clears the selected file and optionally retains the preview.
- **`fileToBase64(file: File)`**:
  - **Input**: `file: File`
  - **Returns**: `Promise<string>` - The base64-encoded string of the file.

#### Core Upload Logic
- **`analyzeImage()`**: The main function that orchestrates the image upload and analysis process via WebSocket.
- **`createUploadViaWebsocket(args)`**:
  - **Input**: An object containing `file`, `token`, `requestData`, and `onProgress` callback.
  - **Returns**: `Promise<UploadResponse>` - The final upload response from the server.
- **`handleUploadProgress(status, extras)`**: Updates `resultText` to show the current stage of the upload process.

#### WebSocket and Communication
- **`teardownActiveUploadSocket()`**: Closes and cleans up the active WebSocket connection.
- **`extractUploadFromPayload(payload)`**: Extracts and normalizes an `UploadResponse` object from a WebSocket message.
- **`normalizeSocketError(error)`**: Converts a structured error from the socket into a user-friendly string.

#### Chat and Questions
- **`handleAskQuestion()`**: Initiates the process of asking a question about the uploaded text.
- **`submitUploadQuestion(args)`**:
  - **Input**: An object with `token`, `instanceId`, and `question`.
  - **Returns**: `Promise<string>` - The answer to the question.
- **`handleQuestionResponseFromSocket(payload)`**: Parses WebSocket messages to find answers to pending questions.
- **`extractAnswerFromQuestionPayload(payload)`**: Scans a WebSocket payload to find and return the answer string.
- **`resetChatState()`**: Resets all variables related to the chat UI and state.
- **`hydrateChatFromFollowups(followups)`**: Populates the chat history from existing Q&A data.
- **`appendChatMessage(message)`**: Adds a new message to the `chatMessages` array.
- **`createChatMessage(role, text)`**: Creates a new `ChatMessage` object with a unique ID.
- **`appendAnsweredQuestionToChat(entry)`**: Adds a Q&A pair to the chat, avoiding duplicates.

#### UI Event Handlers
- **`triggerFileDialog()`**: Programmatically opens the file selection dialog.
- **`handleDropZoneKeydown(event)`**: Allows triggering the file dialog with a keyboard.
- **`handleDragEnter(event)`**, **`handleDragOver(event)`**, **`handleDragLeave(event)`**, **`handleDrop(event)`**: Handlers for the drag-and-drop functionality.

#### Recent Uploads Management
- **`removeRecentUpload(id)`**: Removes a specific upload from the `recentUploads` list.
- **`cleanupUploadPreview(upload)`**: Revokes the object URL for a given upload card.
- **`withPreview(upload)`**: Wraps an `UploadResponse` to create an `UploadCard` (currently returns a null preview).

#### Authentication
- **`ensureAccessToken()`**:
  - **Returns**: `Promise<string | null>` - A valid JWT access token, refreshing it if needed.
- **`refreshAccessToken()`**:
  - **Returns**: `Promise<string | null>` - A new access token if the refresh is successful.

#### Utility and Formatting
- **`createResultMessage(upload)`**: Generates a display string from an `UploadResponse`.
- **`formatOptionLabels(upload)`**: Creates an array of human-readable labels for the OCR settings of an upload.
- **`getResultImageSource()`**: Returns the correct URL for the result image, preferring the retained preview.
- **`previewUploadedImage(upload)`**: Opens the full-size uploaded image in a new tab.

