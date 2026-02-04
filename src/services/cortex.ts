/**
 * Cortex Service - Adapted from Emotiv's official cortex-example
 * https://github.com/Emotiv/cortex-example
 * 
 * Handles WebSocket connection to Cortex API for:
 * - Headset discovery and connection
 * - Authentication and session management
 * - Data streaming (EEG, facial expressions, mental commands, etc.)
 * - Training mental commands
 */

const WARNING_CODE_HEADSET_DISCOVERY_COMPLETE = 142;
const WARNING_CODE_HEADSET_CONNECTED = 104;

export type StreamType = 'eeg' | 'fac' | 'pow' | 'mot' | 'met' | 'com' | 'sys' | 'dev';

export interface EmotivUser {
  clientId: string;
  clientSecret: string;
  license?: string;
  debit?: number;
}

export interface HeadsetInfo {
  id: string;
  status: string;
  connectedBy?: string;
  dongle?: string;
  firmware?: string;
  motionSensors?: string[];
  sensors?: string[];
  settings?: any;
}

export interface StreamData {
  stream: StreamType;
  data: any;
  time?: number;
  sid?: string;
}

type MessageHandler = (data: any) => void;
type StreamHandler = (streamData: StreamData) => void;
type WarningHandler = (warning: { code: number; message: string }) => void;

export class CortexService {
  private socket: WebSocket | null = null;
  private user: EmotivUser | null = null;
  private isHeadsetConnected = false;

  // State
  public authToken: string = '';
  public sessionId: string = '';
  public headsetId: string = '';

  // Event handlers
  private streamHandlers: StreamHandler[] = [];
  private warningHandlers: WarningHandler[] = [];
  private messageHandlers: Map<number, { resolve: (value: any) => void; reject: (reason?: any) => void }> = new Map();
  private messageId = 100;

  constructor(private socketUrl: string = 'wss://localhost:6868') { }

  // ==================== Connection ====================

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.socketUrl);

        this.socket.onopen = () => {
          console.log('Cortex WebSocket Connected');
          this.listenForMessages();
          resolve();
        };

        this.socket.onerror = (error) => {
          console.error('Cortex WebSocket Error:', error);
          reject(new Error('Failed to connect to Cortex. Is the Emotiv App running?'));
        };

        this.socket.onclose = () => {
          console.log('Cortex WebSocket Closed');
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private listenForMessages() {
    if (!this.socket) return;

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // Handle warnings
        if (message.warning) {
          console.log('Warning:', message.warning.code, message.warning.message);
          this.warningHandlers.forEach(h => h(message.warning));

          if (message.warning.code === WARNING_CODE_HEADSET_CONNECTED) {
            this.isHeadsetConnected = true;
          }
          if (message.warning.code === WARNING_CODE_HEADSET_DISCOVERY_COMPLETE && !this.isHeadsetConnected) {
            this.refreshHeadsetList();
          }
          return;
        }

        // Handle stream data (has 'sid' field)
        if (message.sid) {
          const streamData: StreamData = {
            stream: this.detectStreamType(message),
            data: message,
            time: message.time,
            sid: message.sid
          };
          this.streamHandlers.forEach(h => h(streamData));
          return;
        }

        // Handle RPC responses
        if (message.id && this.messageHandlers.has(message.id)) {
          const handler = this.messageHandlers.get(message.id)!;
          if (message.error) {
            handler.reject(message.error);
          } else {
            handler.resolve(message.result);
          }
          this.messageHandlers.delete(message.id);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
  }

  private detectStreamType(message: any): StreamType {
    if (message.eeg) return 'eeg';
    if (message.fac) return 'fac';
    if (message.pow) return 'pow';
    if (message.mot) return 'mot';
    if (message.met) return 'met';
    if (message.com) return 'com';
    if (message.sys) return 'sys';
    if (message.dev) return 'dev';
    return 'eeg'; // default
  }

  private sendRequest(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      const id = ++this.messageId;
      const request = {
        jsonrpc: '2.0',
        method,
        params,
        id
      };

      console.log('Sending:', method);
      this.messageHandlers.set(id, { resolve, reject });
      this.socket.send(JSON.stringify(request));
    });
  }

  // ==================== Authentication ====================

  async requestAccess(clientId: string, clientSecret: string): Promise<any> {
    this.user = { clientId, clientSecret };
    return this.sendRequest('requestAccess', {
      clientId,
      clientSecret
    });
  }

  async authorize(): Promise<string> {
    if (!this.user) throw new Error('Must call requestAccess first');

    const result = await this.sendRequest('authorize', {
      clientId: this.user.clientId,
      clientSecret: this.user.clientSecret,
      license: this.user.license || '',
      debit: this.user.debit || 1
    });

    this.authToken = result.cortexToken;
    // Refresh headset list after auth
    this.refreshHeadsetList();
    return this.authToken;
  }

  // ==================== Headset Management ====================

  async queryHeadsets(): Promise<HeadsetInfo[]> {
    const result = await this.sendRequest('queryHeadsets', {});

    if (result && result.length > 0) {
      result.forEach((headset: HeadsetInfo) => {
        if (headset.status === 'connected') {
          this.isHeadsetConnected = true;
        }
      });
    }

    return result || [];
  }

  async controlDevice(headsetId: string, command: string = 'connect'): Promise<any> {
    return this.sendRequest('controlDevice', {
      command,
      headset: headsetId
    });
  }

  refreshHeadsetList() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    const request = {
      jsonrpc: '2.0',
      id: 14,
      method: 'controlDevice',
      params: { command: 'refresh' }
    };
    console.log('Refreshing headset list...');
    this.socket.send(JSON.stringify(request));
  }

  // ==================== Session Management ====================

  async createSession(headsetId: string, status: string = 'active'): Promise<string> {
    if (!this.authToken) throw new Error('Must authorize first');

    this.headsetId = headsetId;
    const result = await this.sendRequest('createSession', {
      cortexToken: this.authToken,
      headset: headsetId,
      status
    });

    this.sessionId = result.id;
    return this.sessionId;
  }

  async closeSession(): Promise<any> {
    if (!this.sessionId) return;

    return this.sendRequest('updateSession', {
      cortexToken: this.authToken,
      session: this.sessionId,
      status: 'close'
    });
  }

  // ==================== Data Streaming ====================

  async subscribe(streams: StreamType[]): Promise<any> {
    if (!this.authToken || !this.sessionId) {
      throw new Error('Must have active session to subscribe');
    }

    return this.sendRequest('subscribe', {
      cortexToken: this.authToken,
      session: this.sessionId,
      streams
    });
  }

  async unsubscribe(streams: StreamType[]): Promise<any> {
    return this.sendRequest('unsubscribe', {
      cortexToken: this.authToken,
      session: this.sessionId,
      streams
    });
  }

  onStreamData(handler: StreamHandler) {
    this.streamHandlers.push(handler);
  }

  onWarning(handler: WarningHandler) {
    this.warningHandlers.push(handler);
  }

  // ==================== Training ====================

  async setupProfile(profileName: string, status: 'create' | 'load' | 'save' | 'unload' | 'rename' | 'delete'): Promise<any> {
    return this.sendRequest('setupProfile', {
      cortexToken: this.authToken,
      headset: this.headsetId,
      profile: profileName,
      status
    });
  }

  async queryProfiles(): Promise<any> {
    return this.sendRequest('queryProfile', {
      cortexToken: this.authToken
    });
  }

  async training(action: string, status: 'start' | 'accept' | 'reject' | 'reset' | 'erase', detection: string = 'mentalCommand'): Promise<any> {
    return this.sendRequest('training', {
      cortexToken: this.authToken,
      session: this.sessionId,
      detection,
      action,
      status
    });
  }

  async mentalCommandActiveAction(profile: string, actions: string[]): Promise<any> {
    return this.sendRequest('mentalCommandActiveAction', {
      cortexToken: this.authToken,
      status: 'set',
      session: this.sessionId,
      profile,
      actions
    });
  }

  // ==================== Recording ====================

  async createRecord(title: string, description?: string): Promise<any> {
    return this.sendRequest('createRecord', {
      cortexToken: this.authToken,
      session: this.sessionId,
      title,
      description: description || ''
    });
  }

  async stopRecord(): Promise<any> {
    return this.sendRequest('stopRecord', {
      cortexToken: this.authToken,
      session: this.sessionId
    });
  }

  async injectMarker(label: string, value: string, port?: string, time?: number): Promise<any> {
    return this.sendRequest('injectMarker', {
      cortexToken: this.authToken,
      session: this.sessionId,
      label,
      value,
      port: port || 'marker',
      time: time || Date.now()
    });
  }

  // ==================== High-Level Flows ====================

  /**
   * Complete flow: Request access -> Authorize -> Query headsets -> Connect -> Create session
   */
  async fullConnect(clientId: string, clientSecret: string): Promise<{ headsets: HeadsetInfo[] }> {
    // Request access
    const accessResult = await this.requestAccess(clientId, clientSecret);

    if (accessResult.accessGranted === false) {
      throw new Error('Access not granted. Please approve access in the Emotiv App.');
    }

    // Authorize
    await this.authorize();

    // Query headsets
    const headsets = await this.queryHeadsets();

    return { headsets };
  }

  /**
   * Connect to a specific headset and create session
   */
  async connectHeadset(headsetId: string): Promise<string> {
    // Connect to headset
    await this.controlDevice(headsetId, 'connect');

    // Wait a bit for connection
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create session
    const sessionId = await this.createSession(headsetId);

    return sessionId;
  }

  /**
   * Start streaming data
   */
  async startStreaming(streams: StreamType[], onData: StreamHandler): Promise<void> {
    this.onStreamData(onData);
    await this.subscribe(streams);
  }
}

// Export singleton instance
export const cortexService = new CortexService();
