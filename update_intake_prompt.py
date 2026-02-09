
import os
import json
from aigu.llm import get_langfuse_client

def update_langfuse_prompt():
    print("Connecting to Langfuse...")
    client = get_langfuse_client()
    if not client:
        print("Failed to initialize Langfuse client.")
        return

    # Define the new, enhanced prompt content
    # This combines the user's structure requirement with our detailed extraction logic
    new_prompt_content = """### ROLE
You are the AIGU Intake Orchestrator. Your role is to analyze project descriptions, extract key metadata, and categorize them into the correct governance path.

### INPUT DATA
User Description: {{description}}
Existing Data: {{intakeData}}

### PATHING LOGIC
1. 'Accelerator': Projects involving GenAI, LLMs, AI Agents, or complex multi-step automation.
2. 'Standard': BAU projects, standard migrations, or low-risk software updates.
3. 'Stop': Prohibited Shadow IT (e.g., personal Dropbox, public GitHub for private data, unverified webhooks).

### CRITICAL INSTRUCTIONS
- **Project Name**: You MUST extract a professional title (max 50 chars) from the description. Never use "Untitled".
- **Artifact Scan**: List any technical documents mentioned (e.g., "diagram", "policy", "test plan").
- **Transparency**: The 'reason' must clearly explain the decision.

### EXTRACTION TASK
1. Extract values for the following fields into a nested 'extractedData' object:
   Fields: projectName, owner, businessArea, problemStatement, solutionBrief, timelines, sponsorship, lifecycleStatus, successCriteria, technicalApproach, resources, businessValue, financialBenefits, funding, raids, architectureVision
   - If a field is explicitly mentioned or strongly implied, extract it.
   - If 'funding' is mentioned (e.g. '$10m'), extract it.
   - If 'timelines' are mentioned (e.g. '5 weeks'), extract it.
   - If 'sponsorship' is mentioned (e.g. 'Rick'), extract it.
2. Identify which fields are still missing.
3. FOR EACH MISSING FIELD: Provide 'helpText' and a 'contextualExample' tailored to this project's theme.
4. Determine the governance path ('Accelerator', 'Standard', 'Stop').
5. Provide a detailed 'thoughtProcess' explaining your analysis.

### JSON STRUCTURE REQUIRED
You MUST return a valid JSON object matching this structure exactly:
{
  "projectName": "Extracted Title String",
  "path": "Accelerator" | "Standard" | "Stop",
  "reason": "Technical log summary",
  "thoughtProcess": "Detailed analysis of the extraction logic",
  "extractedData": {
      "field1": "value1",
      "field2": "value2"
  },
  "missingFields": ["list", "of", "missing", "fields"],
  "contextualHelp": {
      "missingField1": {"helpText": "...", "contextualExample": "..."}
  },
  "preliminaryRiskLevel": "Low" | "Medium" | "High"
}
"""

    print("Updating prompt 'intake-orchestrator' in Langfuse...")
    try:
        # Create a new prompt version (or update existing if possible via create with same name)
        client.create_prompt(
            name="intake-orchestrator",
            prompt=new_prompt_content,
            labels=["production"],
            type="text",
            config={
                "model": "amazon.nova-pro-v1:0",
                "parameters": {
                    "temperature": 0.1,
                    "max_tokens": 2000
                }
            }
        )
        print("Successfully updated 'intake-orchestrator' prompt.")
    except Exception as e:
        print(f"Error updating prompt: {e}")

if __name__ == "__main__":
    update_langfuse_prompt()
