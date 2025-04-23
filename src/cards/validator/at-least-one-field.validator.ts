import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
    registerDecorator,
    ValidationOptions,
  } from 'class-validator';
  
  @ValidatorConstraint({ async: false })
  export class AtLeastOneFieldDefinedConstraint implements ValidatorConstraintInterface {
    validate(dto: any, args: ValidationArguments) {
      // Kiểm tra xem có ít nhất một giá trị không rỗng hay không.
      return (
        (dto.front_text && dto.front_text.trim() !== '') ||
        (dto.back_text && dto.back_text.trim() !== '') ||
        (dto.example && dto.example.trim() !== '')
      );
    }
  
    defaultMessage(args: ValidationArguments) {
      return 'Phải cung cấp ít nhất một trường: front_text, back_text, hoặc example';
    }
  }
  
  export function AtLeastOneFieldDefined(validationOptions?: ValidationOptions) {
    return function (target: Function) {
      registerDecorator({
        name: 'AtLeastOneFieldDefined',
        target: target,
        propertyName: '',
        options: validationOptions,
        validator: AtLeastOneFieldDefinedConstraint,
        // Vì đây là validator cấp class, chúng ta bỏ qua giá trị của property
        async: false,
      });
    };
  }
  