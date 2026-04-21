<script lang="ts">
  import type { ChatMessage } from '@repo/schemas'
  import { streamChat } from '$lib/chat-client'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'

  let messages = $state<ChatMessage[]>([])
  let input = $state('')
  let sending = $state(false)
  let error = $state<string | null>(null)

  async function send() {
    const content = input.trim()
    if (!content || sending) return

    const next: ChatMessage[] = [...messages, { role: 'user', content }]
    messages = next
    input = ''
    sending = true
    error = null

    const assistantIndex = messages.length
    messages = [...messages, { role: 'assistant', content: '' }]

    try {
      await streamChat({
        model: 'opencode/default',
        messages: next,
        onDelta: (text) => {
          const copy = messages.slice()
          const prev = copy[assistantIndex]
          if (!prev) return
          copy[assistantIndex] = { ...prev, content: prev.content + text }
          messages = copy
        },
      })
    } catch (e) {
      error = e instanceof Error ? e.message : 'unknown error'
      messages = messages.slice(0, -1)
    } finally {
      sending = false
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }
</script>

<main class="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-6">
  <h1 class="text-2xl font-semibold tracking-tight">learn-agent</h1>

  <div class="flex min-h-[300px] flex-col gap-3">
    {#each messages as m}
      <div
        class="max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm"
        class:self-end={m.role === 'user'}
        class:bg-primary={m.role === 'user'}
        class:text-primary-foreground={m.role === 'user'}
        class:self-start={m.role !== 'user'}
        class:bg-muted={m.role !== 'user'}
        class:text-foreground={m.role !== 'user'}
      >
        {m.content}
      </div>
    {/each}
  </div>

  {#if error}
    <div class="text-sm text-destructive">error: {error}</div>
  {/if}

  <form class="flex gap-2" onsubmit={(e) => { e.preventDefault(); send() }}>
    <Input
      type="text"
      bind:value={input}
      onkeydown={onKey}
      placeholder="Say something..."
      disabled={sending}
      class="flex-1"
    />
    <Button type="submit" disabled={sending || !input.trim()}>
      {sending ? '...' : 'Send'}
    </Button>
  </form>
</main>
