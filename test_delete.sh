#!/bin/bash

# Test DELETE endpoint directly
# This tests if the Lambda handler correctly processes DELETE requests

echo "🧪 Testing DELETE /state endpoint..."
echo ""

# Get AWS credentials
AWS_REGION="us-east-1"
API_ENDPOINT="https://7rhp69zmfh.execute-api.us-east-1.amazonaws.com/v1"

# Test parameters
SUBMISSION_ID="test-delete-me"
USER_ID="admin"

echo "📋 Test Parameters:"
echo "  Submission ID: $SUBMISSION_ID"
echo "  User ID: $USER_ID"
echo ""

# First, verify the item exists
echo "1️⃣  Checking if item exists in DynamoDB..."
aws dynamodb get-item \
  --table-name AIGU_Global_State \
  --key "{\"submissionId\":{\"S\":\"$SUBMISSION_ID\"},\"userId\":{\"S\":\"$USER_ID\"}}" \
  --region $AWS_REGION \
  --query "Item.submissionId.S" \
  --output text

if [ $? -eq 0 ]; then
  echo "   ✅ Item exists"
else
  echo "   ❌ Item not found"
  exit 1
fi

echo ""
echo "2️⃣  Sending DELETE request to API Gateway..."

# Use AWS CLI to sign the request
aws apigatewaymanagementapi delete-connection \
  --connection-id "$SUBMISSION_ID" \
  --endpoint-url "$API_ENDPOINT/state?submissionId=$SUBMISSION_ID&userId=$USER_ID" \
  --region $AWS_REGION 2>&1 || echo "   (Expected error - using curl instead)"

echo ""
echo "3️⃣  Alternative: Test with curl (unsigned - will fail auth but shows CORS)"
curl -X DELETE "$API_ENDPOINT/state?submissionId=$SUBMISSION_ID&userId=$USER_ID" \
  -H "Content-Type: application/json" \
  -v 2>&1 | grep -E "(HTTP|CORS|Access-Control)"

echo ""
echo "4️⃣  Checking if item was deleted..."
RESULT=$(aws dynamodb get-item \
  --table-name AIGU_Global_State \
  --key "{\"submissionId\":{\"S\":\"$SUBMISSION_ID\"},\"userId\":{\"S\":\"$USER_ID\"}}" \
  --region $AWS_REGION \
  --query "Item" \
  --output text)

if [ -z "$RESULT" ]; then
  echo "   ✅ Item successfully deleted!"
else
  echo "   ❌ Item still exists - delete failed"
fi

echo ""
echo "📊 Summary:"
echo "  - If item was deleted: Backend DELETE handler works ✅"
echo "  - If item still exists: Check Lambda logs for errors ❌"
echo "  - If CORS error: API Gateway deployment issue ⚠️"
