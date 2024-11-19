export const modelConfig = {
  openai: [
    { name: 'gpt-3.5-turbo', supportsImages: false, supportsAttachments: false },
    { name: 'gpt-4', supportsImages: true, supportsAttachments: false },
    { name: 'gpt-4o', supportsImages: true, supportsAttachments: true },
  ],
  anthropic: [
    { name: 'claude-2.1', supportsImages: false },
    { name: 'claude-3-sonnet-20240229', supportsImages: true },
  ],
  ollama: [
    // Add ollama models here
  ],
};
