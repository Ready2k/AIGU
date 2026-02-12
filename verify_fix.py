
import sys
import os
import json

# Mocking modules to allow import
from unittest.mock import MagicMock
sys.modules['boto3'] = MagicMock()
sys.modules['pypdf'] = MagicMock()
sys.modules['docx'] = MagicMock()
sys.modules['pptx'] = MagicMock()
sys.modules['bs4'] = MagicMock()
sys.modules['atlassian'] = MagicMock()

# Mocking aigu modules
sys.modules['aigu.llm'] = MagicMock()
sys.modules['aigu.llm'].invoke_nova = MagicMock(return_value="Mock Summary")
sys.modules['aigu.llm'].get_active_prompt = MagicMock(return_value="Mock Prompt")

# Add current dir to path to find services
sys.path.append(os.getcwd())

from services.librarian.main import librarian_audit_handler

# problematic state where technicalDesign is a string
mock_state = {
    "submissionId": "test-resubmit",
    "userId": "James",
    "artifacts": {
        "intakeData": {
            "description": "I want to SMS people hot cakes",
            "technicalApproach": "Use a CRM"
        },
        "technicalDesign": "Using a microservices architecture to handle SMS distribution and customer data management.",
        "files": []
    }
}

try:
    print("Testing librarian_audit_handler with stringified technicalDesign...")
    result = librarian_audit_handler(mock_state)
    print("SUCCESS: Handler executed without AttributeError")
    print(f"Librarian Context: {result.get('librarian_context')[:100]}...")
except AttributeError as e:
    print(f"FAILED: AttributeError caught: {e}")
    sys.exit(1)
except Exception as e:
    print(f"FAILED: Unexpected error: {e}")
    sys.exit(1)
