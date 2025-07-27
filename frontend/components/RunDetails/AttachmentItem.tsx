import { formatDateTime, formatFileSize } from "../../utils.jsx";
interface Attachment {
    filename: string;
    created_at: string;
    mime_type: string;
    size: number;
    metadata: Record<string, any>;
}
