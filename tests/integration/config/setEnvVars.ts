import { getUniqueId } from "../mockData/functions";
process.env.SESSION_ID = getUniqueId();
process.env.ATTENDANCE_SERVICE_ENDPOINT="http://localhost:3000/attendance";
process.env.STUDENT_REPORT_ENDPOINT="http://localhost:3000/v1/student_usage_record/event";