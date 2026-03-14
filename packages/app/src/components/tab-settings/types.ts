export interface TabDefinition {
  id: string;
  title: string;
  children?: TabDefinition[];
}
