import * as azdev from 'azure-devops-node-api';
import * as msal from '@azure/msal-node';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CACHE_DIR = path.join(os.homedir(), '.mcp', 'azure-devops-mcp-server');
const TOKEN_CACHE_PATH = path.join(CACHE_DIR, 'token_cache.json');

export class AuthManager {
  private userAccessToken: string | null = null;
  private tokenExpiry: number | null = null;
  private pcaInstance: msal.ConfidentialClientApplication | null = null;
  private connection: azdev.WebApi | null = null;

  constructor(
    private orgUrl: string,
    private pat: string,
    private clientId: string,
    private clientSecret: string,
    private tenantId: string = 'common'
  ) {
    this.loadTokenCache();
  }

  private loadTokenCache() {
    if (fs.existsSync(TOKEN_CACHE_PATH)) {
      try {
        const cache = JSON.parse(fs.readFileSync(TOKEN_CACHE_PATH, 'utf-8'));
        this.userAccessToken = cache.accessToken;
        this.tokenExpiry = cache.expiresOn ? new Date(cache.expiresOn).getTime() : null;
      } catch (e) {
        console.error('Failed to load token cache:', e);
      }
    }
  }

  saveTokenCache(accessToken: string, expiresOn: Date | null) {
    this.userAccessToken = accessToken;
    this.tokenExpiry = expiresOn ? expiresOn.getTime() : null;
    
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    
    fs.writeFileSync(TOKEN_CACHE_PATH, JSON.stringify({ accessToken, expiresOn }, null, 2));
    this.connection = null; // Reset connection to force refresh
  }

  getMSALClient() {
    if (this.pcaInstance) return this.pcaInstance;
    if (!this.clientId || !this.clientSecret) return null;
    
    const msalConfig = {
      auth: {
        clientId: this.clientId,
        authority: `https://login.microsoftonline.com/${this.tenantId}`,
        clientSecret: this.clientSecret,
      },
    };
    this.pcaInstance = new msal.ConfidentialClientApplication(msalConfig);
    return this.pcaInstance;
  }

  async getConnection(): Promise<azdev.WebApi> {
    const now = Date.now();
    const isTokenValid = this.userAccessToken && this.tokenExpiry && now < (this.tokenExpiry - 300000);
    
    if (this.connection && (this.pat || isTokenValid)) {
      return this.connection;
    }

    // 1. Prioritize User Access Token (from login tool)
    if (isTokenValid) {
      const authHandler = azdev.getBearerHandler(this.userAccessToken!);
      this.connection = new azdev.WebApi(this.orgUrl, authHandler);
      return this.connection;
    }

    // 2. Fallback to PAT
    if (this.pat) {
      const authHandler = azdev.getPersonalAccessTokenHandler(this.pat);
      this.connection = new azdev.WebApi(this.orgUrl, authHandler);
      return this.connection;
    } 
    
    // 3. Fallback to Service Principal (OAuth Client Credentials)
    const pca = this.getMSALClient();
    if (pca) {
      const tokenResponse = await pca.acquireTokenByClientCredential({
        scopes: ['499b84ac-1321-427f-aa17-267ca6975798/.default'],
      });

      if (!tokenResponse?.accessToken) {
        throw new Error('Failed to acquire OAuth token.');
      }

      this.saveTokenCache(tokenResponse.accessToken, tokenResponse.expiresOn);
      const authHandler = azdev.getBearerHandler(tokenResponse.accessToken);
      this.connection = new azdev.WebApi(this.orgUrl, authHandler);
      return this.connection;
    }

    throw new Error('No authentication method configured. Please run the "login" tool or set AZURE_DEVOPS_PAT.');
  }

  getOrgUrl() {
    return this.orgUrl;
  }
}
