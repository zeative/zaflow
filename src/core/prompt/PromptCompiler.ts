import Handlebars from 'handlebars';

export class PromptCompiler {
  constructor() {
    this.registerHelpers();
  }

  private registerHelpers() {
    Handlebars.registerHelper('json', (context) => {
      return JSON.stringify(context, null, 2);
    });
    
    Handlebars.registerHelper('if_eq', function(this: any, a, b, opts) {
        if (a == b) {
            return opts.fn(this);
        } else {
            return opts.inverse(this);
        }
    });
  }

  compile(template: string, data: Record<string, any>): string {
    const compiled = Handlebars.compile(template);
    return compiled(data);
  }
}
