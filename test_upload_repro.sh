#!/bash
# Test Script to reproduce Upload and List behavior

API_URL="https://7rhp69zmfh.execute-api.us-east-1.amazonaws.com/v1"
USER_ID="James"
SUBMISSION_ID="test-repro-$(date +%s)"
FILE_NAME="Project_Chronos_Master_Test_Plan.pdf"

echo "1. Getting Upload URL for $FILE_NAME (Submission: $SUBMISSION_ID, User: $USER_ID)..."
UPLOAD_DATA=$(curl -s -X POST "$API_URL/upload" \
  --aws-sigv4 "aws:amz:us-east-1:execute-api" \
  --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"fileName\": \"$FILE_NAME\", \"fileType\": \"application/pdf\", \"submissionId\": \"$SUBMISSION_ID\", \"userId\": \"$USER_ID\"}")

echo "Response: $UPLOAD_DATA"

UPLOAD_URL=$(echo $UPLOAD_DATA | jq -r .url)
# Extract fields. We need to build a multipart form.
# This part is tricky with curl, but let's try.

echo "2. Uploading file to $UPLOAD_URL..."
# Build form fields
FORM_CMD="curl -s -X POST $UPLOAD_URL"
FIELDS=$(echo $UPLOAD_DATA | jq -r '.fields | to_entries[] | "-F \"\(.key)=\(.value)\""' | xargs)
eval "$FORM_CMD $FIELDS -F \"file=@$FILE_NAME\""

echo -e "\n3. Listing files for $SUBMISSION_ID..."
curl -s -X GET "$API_URL/files?submissionId=$SUBMISSION_ID&userId=$USER_ID" \
  --aws-sigv4 "aws:amz:us-east-1:execute-api" \
  --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" | jq .
