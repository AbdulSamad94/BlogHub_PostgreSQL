import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

Object.assign(global, { TextEncoder, TextDecoder });

jest.mock('next/server', () => ({
  NextResponse: {
    json: (...args: any[]) => {
      return {
        json: () => Promise.resolve(args[0]),
        status: args[1]?.status || 200,
      };
    },
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));