<script lang="ts">
  import { Chat } from '@ai-sdk/svelte'
  import { DefaultChatTransport } from 'ai'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'

  const chat = new Chat({
    transport: new DefaultChatTransport({ api: '/v1/ai/chat' }),
  })

  let input = $state('')

  function send() {
    const text = input.trim()
    if (!text || chat.status === 'streaming' || chat.status === 'submitted') return
    chat.sendMessage({ text })
    input = ''
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

  <div class="flex min-h-75 flex-col gap-3">
    {#each chat.messages as m, i (i)}
      <div
        class="max-w-[85%] whitespace-pre-wrap wrap-break-word rounded-lg px-3 py-2 text-sm"
        class:self-end={m.role === 'user'}
        class:bg-primary={m.role === 'user'}
        class:text-primary-foreground={m.role === 'user'}
        class:self-start={m.role !== 'user'}
        class:bg-muted={m.role !== 'user'}
        class:text-foreground={m.role !== 'user'}
      >
        {#each m.parts as part, j (j)}
          {#if part.type === 'text'}{part.text}{/if}
        {/each}
      </div>
    {/each}
  </div>

  {#if chat.error}
    <div class="text-sm text-destructive">error: {chat.error.message}</div>
  {/if}

  <form class="flex gap-2" onsubmit={(e) => { e.preventDefault(); send() }}>
    <Input
      type="text"
      bind:value={input}
      onkeydown={onKey}
      placeholder="Say something..."
      disabled={chat.status === 'streaming' || chat.status === 'submitted'}
      class="flex-1"
    />
    <Button
      type="submit"
      disabled={chat.status === 'streaming' || chat.status === 'submitted' || !input.trim()}
    >
      {chat.status === 'streaming' || chat.status === 'submitted' ? '...' : 'Send'}
    </Button>
  </form>
</main>
