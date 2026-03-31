-- BLUESTORE Chat System Migration

-- 1. Conversations Table
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_message TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_message_sender_id UUID REFERENCES public.profiles(id),
    last_message_is_read BOOLEAN DEFAULT FALSE
);

-- 2. Junction table for participants
CREATE TABLE public.conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(conversation_id, user_id)
);

-- 3. Messages Table
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) NOT NULL,
    text TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 5. Policies for conversation_participants
CREATE POLICY "Users can see their own participation" ON public.conversation_participants
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can join conversations" ON public.conversation_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Policies for conversations
-- Note: Simplified select via participants
CREATE POLICY "Users can view conversations they are in" ON public.conversations
    FOR SELECT USING (
        id IN (
            SELECT conversation_id FROM public.conversation_participants
            WHERE user_id = auth.uid()
        )
    );

-- Allow system/users to create conversations (initial creation doesn't have participants yet in some flows, 
-- but we usually create participants immediately. Let's allow insert for authenticated users.)
CREATE POLICY "Users can create conversations" ON public.conversations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Update policy to allow updating last_message
CREATE POLICY "Users can update their conversations" ON public.conversations
    FOR UPDATE USING (
        id IN (
            SELECT conversation_id FROM public.conversation_participants
            WHERE user_id = auth.uid()
        )
    );

-- 7. Policies for messages
CREATE POLICY "Users can view messages in their conversations" ON public.messages
    FOR SELECT USING (
        conversation_id IN (
            SELECT conversation_id FROM public.conversation_participants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages into their conversations" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        conversation_id IN (
            SELECT conversation_id FROM public.conversation_participants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their received messages as read" ON public.messages
    FOR UPDATE USING (
        conversation_id IN (
            SELECT conversation_id FROM public.conversation_participants
            WHERE user_id = auth.uid()
        )
    );

-- Trigger to update last_message in conversations when a new message is inserted
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations
    SET last_message = NEW.text,
        last_message_at = NEW.created_at,
        last_message_sender_id = NEW.sender_id,
        last_message_is_read = NEW.is_read
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_message_inserted
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();

-- Trigger to update last_message_is_read in conversations when a message is updated to is_read = true
CREATE OR REPLACE FUNCTION public.handle_message_read()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if this was the last message of the conversation
    UPDATE public.conversations
    SET last_message_is_read = NEW.is_read
    WHERE id = NEW.conversation_id 
    AND last_message_at = NEW.created_at;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_message_read
    AFTER UPDATE OF is_read ON public.messages
    FOR EACH ROW 
    WHEN (OLD.is_read IS DISTINCT FROM NEW.is_read)
    EXECUTE FUNCTION public.handle_message_read();

-- UNLOCK MESSAGE UPDATES (For Read Receipts)

-- 1. Allow users to update the 'is_read' status of messages in their own chats
DROP POLICY IF EXISTS "Users can update their received messages as read" ON public.messages;
CREATE POLICY "Users can update their received messages as read" ON public.messages
    FOR UPDATE USING (
        conversation_id IN (
            SELECT conversation_id FROM public.conversation_participants
            WHERE user_id = auth.uid()
        )
    );

-- 2. Force a schema cache reload to apply the new policy immediately
NOTIFY pgrst, 'reload schema';
