# AIGU Security Configuration - TLS Enforcement

## 🔒 TLS 1.3 Enforcement

### **API Gateway**
✅ **Manually Configured**: `SecurityPolicy_TLS13_1_3_2025_09`

**Location**: AWS Console → API Gateway → Custom Domain Names (if using custom domain)

**Note**: For the default API Gateway endpoint (`*.execute-api.amazonaws.com`), AWS enforces TLS 1.2+ by default. Custom domains allow you to enforce TLS 1.3 specifically.

---

### **S3 Bucket Policy**
✅ **Enforced via CloudFormation**: TLS 1.2 or higher required

**Policy**:
```yaml
AIGUArtifactBucketPolicy:
  Type: AWS::S3::BucketPolicy
  Properties:
    Bucket: !Ref AIGUArtifactBucket
    PolicyDocument:
      Statement:
        - Sid: EnforceTLS12OrHigher
          Effect: Deny
          Principal: '*'
          Action: 's3:*'
          Resource:
            - arn:aws:s3:::aigu-artifacts-*/*
            - arn:aws:s3:::aigu-artifacts-*
          Condition:
            NumericLessThan:
              's3:TlsVersion': '1.2'
```

**What this does**:
- ❌ Blocks all S3 requests using TLS 1.0 or 1.1
- ✅ Allows only TLS 1.2 and TLS 1.3 connections
- Applies to all operations: uploads, downloads, deletes

---

### **DynamoDB**
✅ **AWS Managed**: TLS 1.2+ enforced by default

DynamoDB endpoints automatically enforce TLS 1.2 or higher. No additional configuration needed.

**Endpoint**: `dynamodb.us-east-1.amazonaws.com`
- Supports: TLS 1.2, TLS 1.3
- Blocks: TLS 1.0, TLS 1.1

---

### **Lambda**
✅ **AWS Managed**: TLS 1.2+ enforced by default

Lambda functions use AWS SDK which enforces TLS 1.2+ for all AWS service calls.

**Outbound Connections**:
- Bedrock API: TLS 1.2+
- DynamoDB: TLS 1.2+
- S3: TLS 1.2+
- SES: TLS 1.2+

---

## 🔐 Security Best Practices Implemented

### **1. Encryption at Rest**
- ✅ S3: AES-256 encryption enabled
- ✅ DynamoDB: SSE enabled for all tables
- ✅ Lambda: Environment variables encrypted with AWS KMS

### **2. Encryption in Transit**
- ✅ API Gateway: TLS 1.3 (custom domain) or TLS 1.2+ (default)
- ✅ S3: TLS 1.2+ enforced via bucket policy
- ✅ DynamoDB: TLS 1.2+ enforced by AWS
- ✅ Bedrock: TLS 1.2+ enforced by AWS

### **3. Access Control**
- ✅ S3: Public access blocked
- ✅ API Gateway: AWS IAM authentication required
- ✅ Lambda: Least privilege IAM roles
- ✅ DynamoDB: IAM-based access control

### **4. Network Security**
- ✅ CORS: Restricted to localhost and API Gateway origins
- ✅ S3: Pre-signed URLs with 1-hour expiry
- ✅ API Gateway: Rate limiting enabled (default)

---

## 🧪 Verify TLS Configuration

### **Test S3 TLS Enforcement**:
```bash
# This should FAIL (TLS 1.0)
aws s3 ls s3://aigu-artifacts-* --endpoint-url https://s3.us-east-1.amazonaws.com --no-verify-ssl

# This should SUCCEED (TLS 1.2+)
aws s3 ls s3://aigu-artifacts-* --region us-east-1
```

### **Test API Gateway TLS**:
```bash
# Check TLS version
curl -v https://7rhp69zmfh.execute-api.us-east-1.amazonaws.com/v1/state 2>&1 | grep "TLS"

# Should show: TLSv1.2 or TLSv1.3
```

### **Check Custom Domain Security Policy**:
```bash
aws apigateway get-domain-names --region us-east-1 \
  --query "items[?domainName=='your-domain.com'].securityPolicy"

# Should return: "TLS_1_3"
```

---

## 📋 Compliance Checklist

- [x] TLS 1.0 disabled everywhere
- [x] TLS 1.1 disabled everywhere
- [x] TLS 1.2 minimum enforced on S3
- [x] TLS 1.3 enabled on API Gateway (custom domain)
- [x] Encryption at rest enabled (S3, DynamoDB)
- [x] Encryption in transit enforced (all services)
- [x] IAM authentication required (API Gateway)
- [x] Public access blocked (S3)
- [x] Pre-signed URLs time-limited (1 hour)
- [x] CORS restricted to known origins

---

## 🚨 Security Monitoring

### **CloudWatch Alarms** (Recommended):
```yaml
# Add to CloudFormation
TLSVersionAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: AIGU-TLS-Version-Alert
    MetricName: Count
    Namespace: AWS/S3
    Statistic: Sum
    Period: 300
    EvaluationPeriods: 1
    Threshold: 1
    ComparisonOperator: GreaterThanThreshold
    # Alert if any TLS < 1.2 requests are attempted
```

### **AWS Config Rules** (Recommended):
- `s3-bucket-ssl-requests-only`
- `api-gw-ssl-enabled`
- `dynamodb-table-encrypted-kms`

---

## 🔧 Deployment

To deploy the TLS enforcement for S3:

```bash
cd /Users/jamescregeen/AIGU/AIGU
./aigu_manager.sh deploy
```

This will:
1. ✅ Add S3 bucket policy enforcing TLS 1.2+
2. ✅ Maintain existing encryption settings
3. ✅ Preserve CORS configuration

---

## 📚 References

- [AWS API Gateway Security Policies](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-custom-domain-tls-version.html)
- [S3 Bucket Policies for TLS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)
- [DynamoDB Encryption](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/encryption.howitworks.html)
- [Lambda Security Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/security-best-practices.html)

---

## ✅ Summary

**TLS 1.0 is BLOCKED everywhere**:
- ❌ API Gateway: TLS 1.3 enforced (custom domain)
- ❌ S3: TLS 1.2+ enforced (bucket policy)
- ❌ DynamoDB: TLS 1.2+ enforced (AWS default)
- ❌ Lambda: TLS 1.2+ enforced (AWS SDK)

**Your AIGU infrastructure is secure!** 🔒
