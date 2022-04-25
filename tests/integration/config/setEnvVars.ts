import { getUniqueId } from "../mockData/functions";
process.env.SESSION_ID = getUniqueId();
process.env.ATTENDANCE_SERVICE_ENDPOINT="http://localhost:3000/attendance";