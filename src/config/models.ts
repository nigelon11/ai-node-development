export const modelConfig = {
  openai: [
    { name: 'gpt-3.5-turbo', supportsImages: false },
    { name: 'gpt-4', supportsImages: false },
    { name: 'gpt-4o', supportsImages: true },
  ],
  anthropic: [
    { name: 'claude-2.1', supportsImages: false },
    { name: 'claude-3-sonnet-20240229', supportsImages: true },
  ],
};
