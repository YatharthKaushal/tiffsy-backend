# Prompt for Frontend Claude AI Assistant

Copy and paste this prompt to Claude when working on frontend authentication implementation.

---

## 🤖 PROMPT START

I'm working on implementing authentication for the Tiffsy mobile app (React Native / Flutter / React). I have comprehensive authentication documentation from the backend team that explains the complete flow.

**Context:**
- Backend API: Node.js + Express + MongoDB
- Authentication: Firebase Phone OTP + Backend JWT
- User Roles: CUSTOMER, KITCHEN_STAFF, DRIVER, ADMIN
- Platform: [Specify: React Native / Flutter / React Web]

**Documentation Available:**

I have the following documentation files that explain the complete authentication system:

1. **README_AUTHENTICATION.md** - Master overview and index
2. **AUTHENTICATION_FLOW_GUIDE.md** - Complete implementation guide with API reference and code examples
3. **AUTHENTICATION_TROUBLESHOOTING.md** - Common issues and debugging guide
4. **AUTHENTICATION_FLOW_DIAGRAM.md** - Visual flow diagrams for all user types
5. **AUTH_QUICK_REFERENCE.md** - Quick reference card

**Critical Requirements from Documentation:**

The documentation emphasizes these critical points:

1. **ALWAYS call `/api/auth/sync` immediately after Firebase OTP verification** - This is mandatory and links the Firebase UID to the backend user record
2. **Token Management** - Firebase tokens expire after 1 hour and must be refreshed
3. **Role-Based Flow** - Different user roles (Customer, Kitchen Staff, Driver) have different approval workflows
4. **Error Handling** - Proper handling of 401, 403, 400, 404, 500 errors

**What I Need Help With:**

[Choose one or more based on your needs:]

□ **Complete Implementation** - I need to implement the entire authentication flow from scratch following the documentation
□ **Specific User Type** - I need to implement authentication for [Customer / Kitchen Staff / Driver]
□ **Debugging** - I'm getting error: "[error message]" when trying to authenticate
□ **Token Management** - I need help implementing token refresh logic
□ **Registration Flow** - I need help implementing the registration flow for [user type]
□ **Code Review** - I have existing authentication code that needs review against the documentation
□ **Specific Endpoint** - I need help calling endpoint: [endpoint name]

**My Current Situation:**

[Describe your current state:]
- Have you set up Firebase? [Yes/No]
- Have you tested OTP flow? [Yes/No]
- Are you getting any errors? [Describe]
- What have you tried so far? [Describe]

**Expected Assistance:**

Please help me by:
1. Reading and understanding the authentication documentation I'll provide
2. Providing code implementation that follows the documented patterns
3. Explaining any deviations from the documentation
4. Helping debug issues using the troubleshooting guide
5. Ensuring all critical requirements are met

**Code Preferences:**

- Language/Framework: [React Native / Flutter / React / etc.]
- State Management: [Redux / Context API / MobX / Bloc / Provider / etc.]
- API Client: [fetch / axios / dio / etc.]
- Async Pattern: [async/await / Promises / etc.]

---

## 📎 Attach Documentation

After sending this prompt, attach or paste the content of these files:

**Priority 1 (Always include):**
- ✅ AUTHENTICATION_FLOW_GUIDE.md
- ✅ AUTH_QUICK_REFERENCE.md

**Priority 2 (Include if debugging):**
- ✅ AUTHENTICATION_TROUBLESHOOTING.md

**Priority 3 (Include if need visual understanding):**
- ✅ AUTHENTICATION_FLOW_DIAGRAM.md

**Priority 4 (Include for overview):**
- ✅ README_AUTHENTICATION.md

---

## 💡 Example Usage Scenarios

### Scenario 1: Starting from Scratch
```
I'm implementing authentication for a React Native app from scratch.

Setup:
- Firebase Auth configured ✅
- API base URL configured ✅
- No authentication code written yet

Please help me implement the complete authentication flow for CUSTOMER users
following the AUTHENTICATION_FLOW_GUIDE.md. I'm using:
- React Native with Expo
- @react-native-firebase/auth for Firebase
- fetch for API calls
- React Context for state management

Please provide:
1. Complete authentication flow implementation
2. API helper functions
3. Context/Provider setup
4. Navigation logic based on user state
```

### Scenario 2: Debugging Specific Error
```
I'm getting "403 Forbidden - Access denied to this kitchen" error when a
kitchen staff user tries to access the dashboard.

Current flow:
1. User enters phone → Firebase OTP → Verified ✅
2. User navigates to dashboard
3. API call to GET /api/kitchens/dashboard
4. Error: 403 Forbidden

Code:
[paste your authentication code]

Please help me debug this using the AUTHENTICATION_TROUBLESHOOTING.md guide.
```

### Scenario 3: Implementing Specific Feature
```
I need to implement the Kitchen Staff registration flow with approval status handling.

Requirements from documentation:
- Kitchen registration requires admin approval
- Must show pending/rejected screens
- Check kitchenApprovalStatus in sync response

Using React Native with TypeScript.

Please provide:
1. Registration form component
2. API calls for kitchen registration
3. Status checking logic
4. Conditional navigation based on approval status
```

### Scenario 4: Token Management
```
I need to implement proper token refresh logic to prevent 401 errors.

Requirements:
- Firebase tokens expire after 1 hour
- Need to refresh before API calls
- Auto-refresh every 50 minutes

Please help me implement a robust token management system based on the
documentation guidelines.
```

### Scenario 5: Code Review
```
I have existing authentication code but want to verify it follows the
documented best practices.

Please review my code against the AUTHENTICATION_FLOW_GUIDE.md and
AUTH_QUICK_REFERENCE.md:

[paste your code]

Specifically check:
- Is /api/auth/sync being called correctly?
- Is token refresh implemented properly?
- Are approval statuses handled correctly?
- Are errors handled as per documentation?
```

---

## 🎯 What to Expect from Claude

Claude will:
1. ✅ Read and understand the authentication documentation
2. ✅ Provide code that follows documented patterns
3. ✅ Reference specific sections of documentation
4. ✅ Point out critical requirements (like sync endpoint)
5. ✅ Help debug using the troubleshooting guide
6. ✅ Ensure proper error handling
7. ✅ Implement role-based flows correctly

Claude will ensure:
- `/api/auth/sync` is ALWAYS called after Firebase auth
- Token refresh is implemented
- Approval statuses are checked for Kitchen Staff and Drivers
- Error handling matches documentation
- Code follows platform best practices

---

## 📋 Checklist Before Asking

Before asking Claude for help, ensure you have:

- [ ] Read at least the AUTH_QUICK_REFERENCE.md
- [ ] Identified what specific help you need
- [ ] Gathered relevant error messages/logs
- [ ] Prepared your existing code (if any)
- [ ] Specified your platform/framework
- [ ] Attached the relevant documentation files

---

## 🔄 Iterative Development with Claude

### Round 1: Initial Implementation
"Implement basic authentication flow for [user type]"
→ Claude provides initial code

### Round 2: Add Features
"Now add [token refresh / FCM registration / profile update]"
→ Claude extends the code

### Round 3: Debug Issues
"I'm getting error: [error message]"
→ Claude helps debug using troubleshooting guide

### Round 4: Code Review
"Review my complete implementation"
→ Claude checks against documentation

### Round 5: Testing
"Help me write tests for authentication"
→ Claude provides test cases

---

## 💻 Sample Prompt Templates

### Template 1: Complete Implementation
```
I need to implement authentication for [PLATFORM] following the Tiffsy
authentication documentation.

USER TYPE: [Customer / Kitchen Staff / Driver]
PLATFORM: [React Native / Flutter / React]
STATE MANAGEMENT: [Redux / Context / etc.]

REQUIREMENTS:
- Firebase Phone OTP authentication
- Backend sync via /api/auth/sync
- [Registration / Login / Profile] flow
- [Token refresh / Error handling]

Please provide complete implementation with:
1. Authentication service/helper
2. State management setup
3. UI components (if needed)
4. Navigation logic
5. Error handling

I have attached the authentication documentation. Please follow the
patterns and requirements specified in AUTHENTICATION_FLOW_GUIDE.md.
```

### Template 2: Debugging
```
DEBUG REQUEST

ERROR: [Paste error message]
ENDPOINT: [API endpoint]
USER ROLE: [Customer / Kitchen Staff / Driver]

WHAT I'VE TRIED:
[List what you've tried]

CURRENT CODE:
[Paste relevant code]

Please help debug this using the AUTHENTICATION_TROUBLESHOOTING.md guide.
```

### Template 3: Code Review
```
CODE REVIEW REQUEST

Please review my authentication implementation against the Tiffsy
authentication documentation.

FOCUS AREAS:
- Is /api/auth/sync called correctly?
- Token management
- Error handling
- Role-based flows

CODE:
[Paste code]

Please provide:
1. Issues found
2. Suggestions for improvement
3. References to documentation sections
```

---

## 🚨 Important Reminders for Claude

When working with Claude, remind it to:

1. **Always check for `/api/auth/sync` call** - This is the most critical requirement
2. **Verify token refresh logic** - Tokens expire after 1 hour
3. **Check approval status handling** - Kitchen Staff and Drivers need approval
4. **Ensure error handling** - Follow the error patterns in documentation
5. **Reference documentation sections** - Point to specific parts of the guides

---

## 📞 If Claude Needs Clarification

If Claude asks for more information, you can provide:

- **API Base URL**: https://api.tiffsy.com/api
- **Firebase Config**: [Your Firebase project config]
- **Test User**: Phone: +919800000001 (Kitchen Staff)
- **Environment**: Development / Staging / Production

---

## ✅ Success Criteria

Your implementation is correct when:

- [ ] `/api/auth/sync` is called immediately after Firebase OTP
- [ ] Token refresh is implemented and working
- [ ] New users can register successfully
- [ ] Existing users can login successfully
- [ ] Role-based navigation works correctly
- [ ] Kitchen Staff see approval pending states
- [ ] Drivers see approval pending states
- [ ] Errors are handled gracefully
- [ ] User profile updates work
- [ ] FCM token registration works

---

## 🎓 Learning Resources

If Claude suggests something not in the documentation, ask:
"Is this approach documented in the AUTHENTICATION_FLOW_GUIDE.md?"

If Claude skips `/api/auth/sync`, remind:
"The documentation says to ALWAYS call /api/auth/sync first. Can you update the code?"

If Claude uses different patterns, ask:
"The documentation shows [pattern]. Should we follow that instead?"

---

**Remember:** The documentation is the source of truth. Always ask Claude to follow the documented patterns and approaches.

---

## 🤝 Working Effectively with Claude

**DO:**
✅ Provide clear context about your platform and framework
✅ Attach relevant documentation files
✅ Specify what specific help you need
✅ Share error messages and logs
✅ Ask Claude to reference documentation sections
✅ Request explanations for suggested code

**DON'T:**
❌ Assume Claude knows your backend API without documentation
❌ Skip providing error messages when debugging
❌ Mix multiple unrelated requests in one prompt
❌ Forget to specify your platform/framework
❌ Accept solutions that don't call /api/auth/sync

---

## 📝 Example Complete Prompt

```
Hi Claude! I'm implementing authentication for a React Native Tiffsy mobile app.

CONTEXT:
- Platform: React Native (Expo)
- Firebase: @react-native-firebase/auth configured
- State: React Context API
- API Client: fetch
- User Type: Kitchen Staff

DOCUMENTATION:
I have attached the complete authentication documentation from the backend team:
- AUTHENTICATION_FLOW_GUIDE.md
- AUTH_QUICK_REFERENCE.md
- AUTHENTICATION_TROUBLESHOOTING.md

TASK:
Please help me implement the complete authentication flow for Kitchen Staff users,
including:
1. Firebase OTP authentication
2. Backend sync (/api/auth/sync) - CRITICAL
3. Registration flow with kitchen details
4. Approval status handling (PENDING/REJECTED/APPROVED)
5. Token refresh every 50 minutes
6. Error handling for 401, 403, 400, 500
7. Navigation based on approval status

REQUIREMENTS FROM DOCUMENTATION:
- MUST call /api/auth/sync immediately after Firebase OTP
- MUST handle kitchenApprovalStatus in sync response
- MUST show pending/rejected screens appropriately
- MUST refresh tokens before they expire
- MUST handle all error cases

Please provide:
1. Authentication context/provider
2. API helper functions
3. Kitchen registration component
4. Navigation logic
5. Error handling
6. Token management

Follow the patterns in AUTHENTICATION_FLOW_GUIDE.md exactly, especially the
critical requirement to call /api/auth/sync first.

Let me know if you need any clarification!
```

---

**This prompt ensures Claude understands the complete authentication system and implements it correctly according to your backend documentation.**

## 🚀 PROMPT END

---

**How to Use This Prompt:**

1. Copy the relevant sections based on your needs
2. Fill in your specific details (platform, framework, error messages, etc.)
3. Attach the documentation files
4. Send to Claude
5. Iterate based on Claude's responses

**Pro Tip:** Start with a simple scenario and gradually add complexity. This helps Claude provide better, more focused assistance.
