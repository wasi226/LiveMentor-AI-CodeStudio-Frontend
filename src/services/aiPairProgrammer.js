import { API_BASE_URL } from '@/lib/apiBaseUrl';
import { getAuthToken } from '@/lib/authStorage';

const ensureToken = () => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('You must be logged in to use AI pair programmer features.');
  }
  return token;
};

const parseJsonResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || payload?.message || 'AI request failed.');
  }

  return payload;
};

const postAiRequest = async (path, body) => {
  const token = ensureToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  return parseJsonResponse(response);
};

const aiPairProgrammer = {
  explainCode: ({ code, language, focus = '' }) => {
    return postAiRequest('/api/ai/pair/explain', { code, language, focus });
  },

  reviewCode: ({ code, language, goal = '' }) => {
    return postAiRequest('/api/ai/pair/review', { code, language, goal });
  },

  completeCode: ({ code, language, cursorPosition = 0, userIntent = '' }) => {
    return postAiRequest('/api/ai/pair/complete', {
      code,
      language,
      cursorPosition,
      userIntent
    });
  },

  chatAssistant: ({ message, code, language, history = [] }) => {
    return postAiRequest('/api/ai/assistant', { message, code, language, history });
  }
};

export default aiPairProgrammer;
