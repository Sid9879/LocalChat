import mongoose, { Document, Schema } from 'mongoose';

export type ConversationType = 'DIRECT' | 'GROUP';

export interface IConversation extends Document {
  type: ConversationType;
  groupId?: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[];
  lastMessage?: {
    senderId: mongoose.Types.ObjectId;
    content: string;
    type: string;
    createdAt: Date;
  };
  lastMessageAt: Date;
  hiddenFor?: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    type: {
      type: String,
      enum: ['DIRECT', 'GROUP'],
      required: true,
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
      index: true,
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      senderId: { type: Schema.Types.ObjectId, ref: 'User' },
      content: { type: String },
      type: { type: String, default: 'TEXT' },
      createdAt: { type: Date },
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    hiddenFor: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

ConversationSchema.index({ participants: 1 });

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
