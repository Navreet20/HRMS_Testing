export interface SkillsGateway {
  listSkills(): Promise<unknown>;
  createSkill(body: unknown): Promise<unknown>;
  updateSkill(skillId: string, body: unknown): Promise<unknown>;
}
