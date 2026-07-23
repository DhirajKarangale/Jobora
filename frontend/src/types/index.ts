export interface Job {
  id: string;
  sourceName: string;
  companyName: string | null;
  description: string | null;
  link: string | null;
  isApplied?: boolean;
  addedDate?: string | null;
}

export interface ParsedJobData {
  title?: string;
  skills?: string[];
  experience?: string;
  education?: string;
  salary?: string;
  location?: string;
  employment_type?: string;
  extra?: string[];
  [key: string]: any;
}

export interface ParsedDescriptionResult {
  isJson: boolean;
  data: ParsedJobData | null;
  raw: string;
  title: string;
}

export interface ToggleAppliedResponse {
  success: boolean;
  jobId: string;
  isApplied: boolean;
}
