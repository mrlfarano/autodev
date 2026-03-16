#!/usr/bin/env node
// bin/cli.js — autodev CLI: starts web server and opens browser

import { startServer } from '../server/index.js';

const port = process.env.AUTODEV_PORT || 0; // 0 = random available port
startServer(port);
