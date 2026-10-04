import mongoose, { Document, Schema } from 'mongoose';

export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'SYSTEM';
export type DeliveryStatus = 'SENT' | 'DELIVERED' | 'READ';

export interface IAttachment {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface IMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  type: MessageType;
  content: string;
  attachment?: IAttachment;
  replyTo?: mongoose.Types.ObjectId;
  deliveryStatus: DeliveryStatus;
  readBy: {
    userId: mongoose.Types.ObjectId;
    readAt: Date;
  }[];
  isEdited?: boolean;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'SYSTEM'],
      default: 'TEXT',
    },
    content: {
      type: String,
      default: '',
    },
    attachment: {
      filename: String,
      originalName: String,
      mimeType: String,
      size: Number,
      url: String,
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    deliveryStatus: {
      type: String,
      enum: ['SENT', 'DELIVERED', 'READ'],
      default: 'SENT',
    },
    readBy: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for cursor-based chat pagination
MessageSchema.index({ conversationId: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
