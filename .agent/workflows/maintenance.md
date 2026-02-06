---
description: How to maintain the AIGU system
---

# AIGU Maintenance Workflow

Follow these steps to ensure the system remains healthy and aligned with the A2UI pattern.

### 1. Verification
Before making changes, verify the current state:
```bash
./aigu_manager.sh test
```

### 2. State Modification
If adding a new governance requirement:
1. Update `GlobalState` in `aigu/state.py`.
2. Implement the agent node in `aigu/agents/`.
3. Link the node in `aigu/graph.py`.

### 3. Deployment
// turbo
Deploy all layers (Persistence, Logic, Gateway):
```bash
./aigu_manager.sh deploy
```

### 4. Security Audit
Ensure no keys are leaked:
```bash
grep -rnE "AKIA[0-9A-Z]{16}" .
```

### 5. Log Monitoring
Watch the "Brain" in real-time:
```bash
./aigu_manager.sh logs
```
