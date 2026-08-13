declare module 'googleapis' {
  export interface GoogleAuth {
    generateAuthUrl(options: { access_type: string; scope: string[] }): string;
    getToken(code: string): Promise<{ tokens: any }>;
    setCredentials(tokens: any): void;
  }

  export interface GoogleOAuth2 {
    new (clientId: string | undefined, clientSecret: string | undefined, redirectUri: string | undefined): GoogleAuth;
  }

  export namespace google {
    const auth: { OAuth2: GoogleOAuth2 };
    function calendar(options: { version: string; auth: GoogleAuth }): {
      events: {
        insert: (params: { calendarId: string; requestBody: any }) => Promise<{ data: any }>;
        list: (params: { calendarId: string; timeMin?: string; timeMax?: string; singleEvents: boolean; orderBy: string }) => Promise<{ data: { items?: any[] } }>;
      };
    };

    namespace calendar_v3 {
      export interface Schema$Event {
        summary?: string;
        description?: string;
        start?: { date?: string; dateTime?: string };
        end?: { dateTime?: string };
        colorId?: string;
        reminders?: { useDefault: boolean; update: any[] };
      }
    }

    const calendar_v3: typeof google.calendar_v3;
  }

  export const calendar_v3: typeof google.calendar_v3;
  export const google: typeof google;
}