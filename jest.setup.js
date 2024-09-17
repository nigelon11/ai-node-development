require('@anthropic-ai/sdk/shims/node');
require('@testing-library/jest-dom');

import { ReadableStream } from 'stream/web';
global.ReadableStream = ReadableStream;
