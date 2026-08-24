#!/usr/bin/env node
import { main } from '../dist/index.js';

main().then((code) => {
  if (code !== 0) {
    process.exit(code);
  }
});
