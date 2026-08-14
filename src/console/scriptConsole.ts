import {
  BrowserConnectionEvent,
  BrowserConsoleEvent,
  BrowserConsoleEventMethods,
  BrowserDocumentEvent,
  BrowserErrorEvent,
  ConsoleLogLevel,
  Server,
} from 'p5-server';
import * as vscode from 'vscode';
import { window, workspace } from 'vscode';
import { padCenter } from '../helpers';
import { formatConsoleEventArgs } from './consoleHelpers';
import { ConsoleMessageProvider } from './consoleMessageProvider';
import util = require('util');

/** Manages the output channel that displays console logs and errors from the
 * running sketch. */
export default class ScriptConsole {
  private _channel: vscode.LogOutputChannel | null = null;
  private banner: string | null = null;
  private source?: string; // the current file or URL that is being displayed in the output
  private messageProvider: ConsoleMessageProvider;
  private readonly disposables: vscode.Disposable[];
  private messageCount = 0; // how many messages have been displayed since clear()?
  private browser: string = 'integrated';
  private autoShowThreshold: BrowserConsoleEventMethods | 'always' | 'never' = 'info';
  private autoShownForSource = false;

  // Adaptive throttling
  private messageTimes: number[] = [];
  private messageTimeIndex = 0; // Track start of valid timestamps
  private batchMode = false;
  private messageBuffer: { level: LogOutputMethod; value: string }[] = [];
  private batchTimer?: NodeJS.Timeout;
  private readonly rateWindowMs = 1000; // Track messages over 1 second
  private readonly highRateThreshold = 20; // Messages per second
  private readonly lowRateThreshold = 5; // Messages per second to exit batch mode
  private readonly batchIntervalMs = 100; // Flush every 100ms when batching

  constructor() {
    const provider = new ConsoleMessageProvider();
    this.messageProvider = provider;
    this.disposables = [
      vscode.languages.registerInlayHintsProvider({ language: 'javascript' }, provider),
      workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('p5-server.browser') || event.affectsConfiguration('p5-server.console')) {
          this.updateConfiguration();
        }
      }),
      provider,
    ];
    this.updateConfiguration();
  }

  public show() {
    this.channel.show(true);
  }

  subscribe(server: Server) {
    server.onScriptEvent('console', (event: BrowserConsoleEvent) => {
      const { method, args, file, url, clientId } = event;
      if (method === 'clear') {
        this.clear();
        this.messageProvider.removeMessages({ clientId });
      } else {
        this.setFile(file, url);
        this.maybeShowConsole(method);
        this.appendLine(normalizeLogLevel(method), util.format(`console.${method}: ${formatConsoleEventArgs(event)}`));
        if (file && event.line && args.length > 0) {
          this.messageProvider.addMessage(event);
        }
      }
    });

    server.onScriptEvent('document', (event: BrowserDocumentEvent) => {
      const { type, clientId, visibilityState } = event;
      if (type === 'visibilitychange' && visibilityState === 'hidden') {
        this.messageProvider.removeMessages({ clientId });
      }
    });

    server.onScriptEvent('error', (event: BrowserErrorEvent) => {
      const { message, file, url, stack } = event;
      this.setFile(file, url);
      this.maybeShowConsole('error');
      let msg = 'Error';
      if (event.type === 'error' && event.line) {
        msg += ` at line ${event.line}`;
      }
      if (file || url) {
        msg += ` of ${file || url}`;
      }
      this.appendLine('error', stack || `${msg}: ${message}`);
      if (event.type === 'error' && file && event.line) {
        this.messageProvider.addMessage(event);
      }
    });

    server.onScriptEvent('connection', (event: BrowserConnectionEvent) => {
      const { type, file, url, clientId } = event;
      if (type === 'opened') {
        this.autoShownForSource = false;
        this.messageProvider.removeMessages({ clientId });
        if (!this.setFile(file, url) && this.messageCount > 0) {
          const label = '[RELOAD]';
          const halfLen = Math.floor((80 - label.length) / 2);
          this.channel.info('-'.repeat(halfLen) + label + '-'.repeat(halfLen));
        }
        this.messageCount = 0;
        if (workspace.getConfiguration('p5-server').get('console.clearOnReload', true)) {
          this.clear();
        }
        // this.maybeShowConsole('always');
      }
    });
  }

  private get channel() {
    this._channel ??= window.createOutputChannel('P5 Sketch', { log: true });
    return this._channel;
  }

  private appendLine(level: LogOutputMethod, value: string) {
    this.updateMessageRate();

    if (this.batchMode) {
      // In batch mode, buffer the message
      this.messageBuffer.push({ level, value });
    } else {
      // Immediate mode - output directly
      if (this.banner) {
        this.channel.info(this.banner);
        this.banner = null;
      }
      this.writeLog(level, value);
    }
    this.messageCount++;
  }

  private clear() {
    this.channel.clear();
    this.banner = null;
    this.messageCount = 0;

    // Clear adaptive throttling state
    this.messageTimes = [];
    this.messageTimeIndex = 0;
    this.messageBuffer = [];
    this.batchMode = false;
    this.stopBatchTimer();
  }

  /** Display the banner if the console is empty, or this is a different url than was
   * previously displayed in this console.
   *
   * Return true iff the banner was displayed.
   */
  private setFile(file?: string, url?: string) {
    const source = file || url;
    if (this.source === source) return false;
    this.source = source;
    this.autoShownForSource = false;
    const label = source ? ` (${source}) ` : '';
    this.banner = padCenter(label, 80, '=');
    this.messageCount = 0;
    return true;
  }

  /** Show the console if the method's log level is greater than the
   * configuration's p5-server.integratedBrowser.autoShow.level. */
  private maybeShowConsole(level: BrowserConsoleEventMethods) {
    if (this.autoShownForSource) return;
    const logLevelIndex = logLevelOrder.indexOf(level);
    const thresholdIndex = logLevelOrder.indexOf(this.autoShowThreshold);
    if (logLevelIndex >= 0 && logLevelIndex <= thresholdIndex) {
      this.channel.show(true);
      this.autoShownForSource = true;
    }
  }

  private updateConfiguration() {
    this.browser = workspace.getConfiguration('p5-server').get('browser', 'integrated');
    const [configKey, defaultValue]: [string, BrowserConsoleEventMethods] =
      this.browser === 'integrated' ? ['integratedBrowser', 'info'] : ['externalBrowser', 'error'];
    this.autoShowThreshold = workspace
      .getConfiguration('p5-server.console')
      .get<BrowserConsoleEventMethods | 'always' | 'never'>(configKey + '.autoShow.level', defaultValue);
    this.autoShownForSource = false;
  }

  /** Track message rate and update batch mode if needed */
  private updateMessageRate() {
    const now = Date.now();
    this.messageTimes.push(now);
    this.updateBatchMode(now);
  }

  private updateBatchMode(now: number) {
    const cutoff = now - this.rateWindowMs;

    // Efficiently remove old timestamps without creating new array every time
    while (this.messageTimeIndex < this.messageTimes.length && this.messageTimes[this.messageTimeIndex] < cutoff) {
      this.messageTimeIndex++;
    }

    // Compact array when needed (only when significant portion is stale)
    if (this.messageTimeIndex > 100 && this.messageTimeIndex > this.messageTimes.length / 2) {
      this.messageTimes = this.messageTimes.slice(this.messageTimeIndex);
      this.messageTimeIndex = 0;
    }

    const currentRate = this.messageTimes.length - this.messageTimeIndex;

    if (!this.batchMode && currentRate > this.highRateThreshold) {
      // Enter batch mode
      this.batchMode = true;
      this.startBatchTimer();
    } else if (this.batchMode && currentRate < this.lowRateThreshold) {
      // Exit batch mode
      this.batchMode = false;
      this.flushMessageBuffer();
      this.stopBatchTimer();
    }
  }

  /** Start the batch timer to periodically flush messages */
  private startBatchTimer() {
    if (this.batchTimer) return;

    this.batchTimer = setInterval(() => {
      this.updateBatchMode(Date.now());
      this.flushMessageBuffer();
    }, this.batchIntervalMs);
  }

  /** Stop the batch timer */
  private stopBatchTimer() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = undefined;
    }
  }

  /** Flush all buffered messages to the output channel */
  private flushMessageBuffer() {
    if (this.messageBuffer.length === 0) return;

    if (this.banner) {
      this.channel.info(this.banner);
      this.banner = null;
    }

    for (const { level, value } of this.messageBuffer) this.writeLog(level, value);
    this.messageBuffer = [];
  }

  private writeLog(level: LogOutputMethod, value: string) {
    this.channel[level](value);
  }

  /** Clean up resources */
  dispose() {
    this.stopBatchTimer();
    this.disposables.forEach(disposable => disposable.dispose());
    if (this._channel) {
      this._channel.dispose();
      this._channel = null;
    }
    this.messageBuffer = [];
    this.messageTimes = [];
    this.messageTimeIndex = 0;
  }
}

/** The log level importance, in decreasing order. A console log message causes the output panel to display if the
 * message's log level is earlier in the array than the log level set in the configuration setting.
 */
const logLevelOrder: (BrowserConsoleEventMethods | 'always' | 'never')[] = [
  'error',
  'warn',
  'log',
  'info',
  'debug',
  'always',
];

type LogOutputMethod = Exclude<ConsoleLogLevel, 'log'>;

function normalizeLogLevel(method: BrowserConsoleEventMethods): LogOutputMethod {
  return method === 'clear' || method === 'log' ? 'info' : method;
}
