#!/bin/bash

# Test script for FCM token registration endpoint
# Replace these values with your actual data

BASE_URL="http://localhost:3000"
FIREBASE_ID_TOKEN="your-firebase-id-token-here"
FCM_TOKEN="test-fcm-token-123456"

echo "Testing FCM token registration endpoint..."
echo "URL: ${BASE_URL}/api/auth/fcm-token"
echo ""

curl -X POST "${BASE_URL}/api/auth/fcm-token" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${FIREBASE_ID_TOKEN}" \
  -d "{
    \"fcmToken\": \"${FCM_TOKEN}\",
    \"deviceType\": \"ANDROID\",
    \"deviceId\": \"test-device-001\"
  }" \
  -w "\n\nHTTP Status: %{http_code}\n" \
  -v

echo ""
echo "If you see HTML in the response, check:"
echo "1. Is the server running?"
echo "2. Is the base URL correct?"
echo "3. Is the Firebase ID token valid?"
echo "4. Are you using the correct endpoint path (/api/auth/fcm-token)?"
