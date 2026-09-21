#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## Iteration 2 — Main agent (Connections, Weekend Digest, Event Reminders, Verified Lounge)
backend:
  - task: "Connections 1:1 (POST /api/connections/{user_id}, GET /api/connections, accept/decline; mutual tap auto-opens DM circle type=dm; GET /api/circles?dm=true; GET /api/users/{id}.connection)"
    implemented: true
    needs_retesting: true
  - task: "Weekend digest GET /api/digest/weekend (Fri–Sun events grouped by day, vibe_count, headline; rolls to next weekend on Sat/Sun if empty)"
    implemented: true
    needs_retesting: true
  - task: "Reminders GET /api/reminders (RSVPed events starting within 120 min, LA timezone), POST /api/reminders/{event_id}/dismiss"
    implemented: true
    needs_retesting: true
  - task: "Verified Lounge GET /api/lounge (locked for unverified; auto-joins verified); verified_only circles hidden/403 for unverified"
    implemented: true
    needs_retesting: true
frontend:
  - task: "Match detail Connect button states (Connect / Requested / Accept & chat / Message)"
    needs_retesting: true
  - task: "Circles tab: Messages segment (requests accept/decline + DM list), Verified Lounge card (locked teaser vs open)"
    needs_retesting: true
  - task: "Home: reminder nudge banners, Weekend Digest card -> /digest screen"
    needs_retesting: true
  - task: "Profile: Verified Lounge row after verify"
    needs_retesting: true
agent_communication:
  - agent: "main"
    message: "Backend flows verified via python requests script (connect->mutual->DM, reminders window, lounge gating). Need E2E frontend + backend regression test."

## Iteration 3 — Security hardening (after security audit)
backend:
  - task: "SEC-001 JWT_SECRET rotated to strong random (old tokens invalid; users must re-login)"
    needs_retesting: true
  - task: "SEC-002 GET /circles/{id}/messages requires membership (403 otherwise); GET /circles/{id} for DM requires membership (404 otherwise); group circles still previewable for non-members so Join works"
    needs_retesting: true
  - task: "SEC-003 /upload allow-lists image content types (415 otherwise), 10MB cap (413); /files served with stored allow-listed content type + nosniff"
    needs_retesting: true
  - task: "SEC-004 search q re.escape'd + max_length=80 on /users, /events, /recommendations"
    needs_retesting: true
  - task: "Hardening: signup password min 8 (422), message max 2000, auth rate limit 30/min/IP (429), security headers, CORS allow_credentials=False"
    needs_retesting: true
frontend:
  - task: "signup shows 'Password must be at least 8 characters'; api.ts maps 422 detail arrays to readable message; circle chat empty state says 'Join this Circle to see the conversation' for non-members"
    needs_retesting: true
agent_communication:
  - agent: "main"
    message: "Verified locally via python: 403 non-member messages, 415 html upload, 422 short pw, 429 rate limit, headers present. Need regression of full app (auth, circles join flow, DM, lounge, uploads) after hardening."
