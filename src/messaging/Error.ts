export interface IErrorData {
  code: string;
  message: string;
}

export class TypedError extends Error implements IErrorData {

  code: string;
  message: string;

  constructor(errorData: IErrorData);
  constructor(code: string, message: string);
  constructor(codeOrErrorData: string | IErrorData, message?: string) {
    if (message) {
      super(message);
      this.code = codeOrErrorData as string;
    } else {
      let errorData = codeOrErrorData as IErrorData;
      super(errorData.message);
      this.code = (codeOrErrorData as IErrorData).code;
    }
  }

}
