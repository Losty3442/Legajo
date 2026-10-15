import type { Workspace, DocumentFile, Teacher, Merit, ApplicationRequest, Evaluation } from "../domain/models";
export interface TeacherRepository {
  list(): Promise<Teacher[]>;
}
export interface DossierRepository {
  list(): Promise<Merit[]>;
}
export interface RequestRepository {
  list(): Promise<ApplicationRequest[]>;
}
export interface EvaluationRepository {
  list(): Promise<Evaluation[]>;
}
export interface DocumentRepository {
  get(id: string): Promise<DocumentFile | undefined>;
}
export interface WorkspaceRepository {
  read(): Promise<Workspace | undefined>;
  /** Atomic compare-and-swap of workspace and document blobs. Reject stale revisions. */
  commit(next: Workspace, expectedRevision: number | undefined, documents?: DocumentFile[], reset?: boolean): Promise<void>;
}
export interface Repositories {
  workspace: WorkspaceRepository;
  documents: DocumentRepository;
  teachers: TeacherRepository;
  dossiers: DossierRepository;
  requests: RequestRepository;
  evaluations: EvaluationRepository;
}
