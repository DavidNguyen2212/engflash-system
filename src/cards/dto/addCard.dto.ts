import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class AddCardDTO {
    @IsNotEmpty({ message: "If front_text, can't be null"})
    front_text: string

    @IsOptional()
    @IsNotEmpty({ message: "If back_text, can't be null"})
    back_text?: string

    @IsOptional()
    @IsNotEmpty({ message: "If example, can't be null"})
    example?: string

    @IsOptional()
    @IsNotEmpty({ message: "if topic_id, can't be null"})
    topic_id: number
}

export class NewMeaningDTO {
    @IsNotEmpty({ message: "If front_text, can't be null"})
    front_text: string
}

export class ProcessVideoDto {
    @IsNotEmpty()
    @IsString()
    url: string;
  }

export class ProcessTranscriptDto {
    @IsNotEmpty()
    @IsString()
    url: string;

    @IsNotEmpty()
    @IsString()
    level: string;
  }