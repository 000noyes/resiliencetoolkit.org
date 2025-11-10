declare module '@storybook/react' {
  export type Meta<TComponent = unknown> = Record<string, unknown> & {
    component?: TComponent;
  };
  export type StoryObj<TMeta = unknown> = Record<string, unknown> & {
    args?: unknown;
  };
}
