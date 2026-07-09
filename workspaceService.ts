
export interface GoogleContact {
  name: string;
  email?: string;
  phone?: string;
}

export const fetchContacts = async (accessToken: string): Promise<GoogleContact[]> => {
  const response = await fetch(
    'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const detail = errorData.error?.message || response.statusText || 'Unknown error';
    throw new Error(`Failed to fetch contacts: ${detail}`);
  }
  
  const data = await response.json();
  const connections = data.connections || [];
  
  return connections.map((person: any) => ({
    name: person.names?.[0]?.displayName || 'Unknown',
    email: person.emailAddresses?.[0]?.value,
    phone: person.phoneNumbers?.[0]?.value,
  }));
};

export const uploadToDrive = async (
  accessToken: string,
  fileName: string,
  content: string,
  mimeType: string = 'text/plain'
): Promise<string> => {
  const metadata = {
    name: fileName,
    mimeType: mimeType,
  };
  
  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', new Blob([content], { type: mimeType }));
  
  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const detail = errorData.error?.message || response.statusText || 'Unknown error';
    throw new Error(`Failed to upload to Drive: ${detail}`);
  }
  
  const data = await response.json();
  return data.id;
};

export const listDriveFiles = async (accessToken: string): Promise<any[]> => {
  const response = await fetch(
    'https://www.googleapis.com/drive/v3/files?pageSize=10&fields=files(id,name,mimeType)',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const detail = errorData.error?.message || response.statusText || 'Unknown error';
    throw new Error(`Failed to list Drive files: ${detail}`);
  }
  
  const data = await response.json();
  return data.files || [];
};

export const listChatSpaces = async (accessToken: string): Promise<any[]> => {
  const response = await fetch(
    'https://chat.googleapis.com/v1/spaces',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Chat API Error:', errorData);
    const detail = errorData.error?.message || response.statusText || JSON.stringify(errorData) || 'Unknown error';
    throw new Error(`Failed to list Chat spaces: ${detail}`);
  }
  
  const data = await response.json();
  return data.spaces || [];
};
