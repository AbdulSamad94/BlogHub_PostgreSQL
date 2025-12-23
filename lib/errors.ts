export enum ErrorCode {
    NOT_FOUND = "NOT_FOUND",
    UNAUTHORIZED = "UNAUTHORIZED",
    FORBIDDEN = "FORBIDDEN",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    INTERNAL_ERROR = "INTERNAL_ERROR",
    UPLOAD_ERROR = "UPLOAD_ERROR"
}

export class ServiceError extends Error {
    constructor(
        public readonly code: ErrorCode,
        public readonly statusCode: number,
        message: string
    ) {
        super(message);
        this.name = "ServiceError";
    }

    static notFound(message: string = "Resource not found") {
        return new ServiceError(ErrorCode.NOT_FOUND, 404, message);
    }

    static unauthorized(message: string = "Unauthorized") {
        return new ServiceError(ErrorCode.UNAUTHORIZED, 401, message);
    }

    static forbidden(message: string = "Forbidden") {
        return new ServiceError(ErrorCode.FORBIDDEN, 403, message);
    }

    static validationError(message: string = "Validation failed") {
        return new ServiceError(ErrorCode.VALIDATION_ERROR, 400, message);
    }

    static internalError(message: string = "Internal server error") {
        return new ServiceError(ErrorCode.INTERNAL_ERROR, 500, message);
    }

    static uploadError(message: string = "Upload failed") {
        return new ServiceError(ErrorCode.UPLOAD_ERROR, 400, message);
    }
}
