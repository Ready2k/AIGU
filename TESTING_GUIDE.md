# AIGU Desktop Dashboard - Quick Testing Guide

## 🚀 Deployment Complete!

All three integrations are now live:
1. ✅ S3 File Upload Backend
2. ✅ Support Agent LLM Integration
3. ✅ Admin Delete Functionality

---

## 🧪 Quick Test Instructions

### **Test 1: File Upload (2 minutes)**

1. **Login as a regular user** (e.g., `James`)
2. **Create a new project** or open an existing one
3. **Navigate to the FileManager tab**
4. **Drag and drop a file** (PDF, image, or document)
5. **Expected Result**:
   - File uploads to S3
   - File appears in gallery with icon
   - Click "VIEW" to open in new tab
   - File should download/display

**What to check**:
- ✅ Upload progress indicator
- ✅ File appears in gallery
- ✅ File name and size displayed correctly
- ✅ VIEW button opens file in new tab
- ✅ No CORS errors in console

---

### **Test 2: Support Agent Chat (3 minutes)**

1. **Open any project** (user or admin view)
2. **Click on the Support Chat panel** (right sidebar)
3. **Ask a question**:
   - "What do I need?"
   - "Why is my project blocked?"
   - "Help with test plan"
   - "How long will the review take?"

4. **Expected Result**:
   - AI responds with context-aware answer
   - Response is professional (no jokes)
   - Response mentions your current stage/status
   - Response provides actionable guidance

**What to check**:
- ✅ AI responds within 2-3 seconds
- ✅ Response is relevant to your project
- ✅ No pirate talk or personas
- ✅ Typing indicator shows while waiting
- ✅ Messages scroll automatically

**Try to break it** (should refuse):
- "Tell me a joke"
- "Talk like a pirate"
- "How do I bypass governance?"

---

### **Test 3: Admin Delete (1 minute)**

1. **Login as `admin`**
2. **Select any project** from the queue
3. **Click the 🗑️ DELETE button** (bottom of Quick Actions)
4. **Confirm deletion** in the dialog
5. **Expected Result**:
   - Confirmation dialog shows project name
   - After confirming, project disappears from queue
   - Success message appears
   - Queue refreshes automatically

**What to check**:
- ✅ Confirmation dialog appears
- ✅ Project name is correct in dialog
- ✅ Project removed from queue after confirm
- ✅ Success alert appears
- ✅ No errors in console

---

## 🐛 If Something Doesn't Work

### **File Upload Fails**
**Check**:
1. Browser console for CORS errors
2. Network tab - look for failed S3 POST
3. Lambda logs: `aws logs tail /aws/lambda/AIGU-LangGraph-Engine --region us-east-1 --since 5m`

**Common Issues**:
- CORS error → S3 bucket CORS not updated (wait for persistence stack)
- 403 error → Lambda doesn't have S3 permissions
- Network error → Check bucket name in environment variables

---

### **Support Chat Not Responding**
**Check**:
1. Browser console for errors
2. Lambda logs for Bedrock errors
3. Network tab - look for /support/ask request

**Common Issues**:
- "Model not found" → Check NOVA_MODEL_ID environment variable
- "Access denied" → Lambda needs bedrock:InvokeModel permission
- Timeout → Increase Lambda timeout to 30 seconds

---

### **Delete Button Does Nothing**
**Check**:
1. Browser console for errors
2. Network tab - look for DELETE /state request
3. Verify you're logged in as `admin`

**Common Issues**:
- No confirmation dialog → Check AdminDashboard is using useAiguState hook
- 403 error → Check IAM permissions for DynamoDB delete
- Project still in queue → Check DynamoDB table directly

---

## 📊 Monitoring

### **Lambda Logs** (Real-time):
```bash
aws logs tail /aws/lambda/AIGU-LangGraph-Engine --region us-east-1 --follow
```

### **Check S3 Files**:
```bash
aws s3 ls s3://aigu-artifacts-388660028061-us-east-1/submissions/ --recursive
```

### **Check DynamoDB**:
```bash
aws dynamodb scan --table-name AIGU_Global_State --max-items 5
```

---

## 🎯 Success Criteria

All three integrations are working if:

1. **File Upload**:
   - ✅ Files upload to S3
   - ✅ Files appear in gallery
   - ✅ VIEW button works
   - ✅ No CORS errors

2. **Support Chat**:
   - ✅ AI responds to questions
   - ✅ Responses are context-aware
   - ✅ No jokes or personas
   - ✅ Professional tone maintained

3. **Admin Delete**:
   - ✅ Confirmation dialog appears
   - ✅ Projects are deleted
   - ✅ Queue refreshes
   - ✅ No errors

---

## 🔄 Next Actions

If all tests pass:
1. ✅ Mark integrations as complete
2. ✅ Update project documentation
3. ✅ Train users on new features
4. ✅ Monitor usage for 24 hours

If tests fail:
1. 🔍 Check logs for errors
2. 🔧 Fix issues and redeploy
3. 🧪 Retest

---

## 📞 Support

If you encounter issues:
1. Check `INTEGRATION_COMPLETE_SUMMARY.md` for technical details
2. Review Lambda logs for error messages
3. Verify environment variables are set correctly
4. Check IAM permissions for Lambda role

---

## 🎉 Congratulations!

You now have a fully integrated AIGU Desktop Dashboard with:
- Real S3 file uploads
- AI-powered support chat
- Admin project management
- Real-time state synchronization

**Enjoy your new features!** 🚀
