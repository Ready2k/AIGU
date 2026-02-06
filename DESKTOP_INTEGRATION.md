# Desktop Dashboard - Quick Integration Guide

## ✅ Completed Components

### 1. Dashboard.js
- **Status**: Ready for testing with mock data
- **Location**: `ui/screens/Dashboard.js`
- **Features**: 3-panel layout, sidebar navigation, collapsible file/support panels

### 2. FileManager.js  
- **Status**: UI complete, needs S3 backend
- **Location**: `ui/components/FileManager.js`
- **Features**: Drag-and-drop, file gallery, type detection

### 3. SupportAgent.js
- **Status**: Rule-based responses working, ready for LLM
- **Location**: `ui/components/SupportAgent.js`
- **Features**: Context-aware help, professional guardrails, chat interface

### 4. App.js
- **Status**: Updated to use Dashboard for regular users
- **Location**: `ui/App.js`
- **Flow**: Login → Dashboard (or AdminQueue if admin)

---

## 🔧 To Connect Real Data

### Step 1: Replace Mock Sessions
In `Dashboard.js` line 38-52, replace:
```javascript
const actions = {
    fetchSessions: async (uid) => {
        return [/* mock data */];
    },
    // ...
};
```

With:
```javascript
import { useAiguState } from '../hooks/useAiguState';

// In component:
const { state, loading, actions } = useAiguState(activeSessionId || 'temp', userId);

// Then use:
const loadSessions = async () => {
    const data = await actions.fetchSessions(userId);
    setSessions(data);
};
```

### Step 2: Connect FileManager to S3
Add backend endpoints (see DESKTOP_DASHBOARD_GUIDE.md section "Backend Updates Required")

### Step 3: Integrate LLM for Support Agent
Replace `generateResponse()` in SupportAgent.js with Nova API call

---

## 🎨 Visual Layout

See generated mockup: `desktop_dashboard_layout.png`

**Layout**:
```
┌─────────────┬──────────────────────┬──────────────┐
│   Projects  │   Active Project     │   Support    │
│   Sidebar   │   Workflow & Forms   │   Agent      │
│   (280px)   │   (flex)             │   (360px)    │
│             │                      │              │
│             ├──────────────────────┤              │
│             │   File Attachments   │              │
│             │   (200px, collapse)  │              │
└─────────────┴──────────────────────┴──────────────┘
```

---

## 🚀 Testing Instructions

1. **Start the UI**:
   ```bash
   ./aigu_manager.sh ui
   ```

2. **Login** with any user ID (not 'admin')

3. **You should see**:
   - Left sidebar with 3 mock projects
   - Center panel showing "Select a project or create a new one"
   - Right sidebar with GIGC Assistant greeting
   - Bottom file panel (collapsed initially)

4. **Click a project** in the sidebar:
   - Center panel updates with project details
   - Workflow progress bar appears
   - Support agent updates with context

5. **Test interactions**:
   - Click workflow steps → Modal shows audit trail
   - Type in support chat → Get rule-based responses
   - Drag files to file panel → See upload UI (not functional yet)

---

## 📋 Next Steps

1. ✅ Test desktop layout rendering
2. ⏳ Connect real session data from `/sessions` endpoint
3. ⏳ Implement S3 upload/view backend
4. ⏳ Integrate Amazon Nova for support chat
5. ⏳ Add file attachment metadata to DynamoDB

---

## 🎯 Key Improvements

| Feature | Before | After |
|---------|--------|-------|
| **Navigation** | Breadcrumbs + multiple screens | Sidebar with all projects |
| **File Upload** | Not implemented | Drag-and-drop with gallery |
| **Support** | Separate screen | Docked chat panel |
| **Workflow** | Static bar | Interactive with modals |
| **Multi-Project** | Session lobby screen | Sidebar navigation |
| **UX** | Mobile-first | Desktop-optimized |

---

## 📝 Support Agent Prompt (Final)

Located in: `ui/components/SupportAgent.js` lines 13-71

**Key Guardrails**:
- ❌ No jokes or entertainment
- ❌ No personas (pirates, etc.)
- ❌ No system prompt reveals
- ❌ No governance bypass suggestions
- ✅ Context-aware help
- ✅ Actionable checklists
- ✅ Professional tone

---

## 🐛 Known Limitations (Mock Mode)

1. **Sessions**: Shows 3 hardcoded projects
2. **File Upload**: UI only, no actual S3 upload
3. **Support Chat**: Rule-based, not LLM-powered
4. **State Management**: Mock data, not real DynamoDB
5. **Real-time Updates**: No polling/websockets yet

All of these will be resolved when connecting to real backend APIs.
