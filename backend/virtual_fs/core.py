import os
import shlex
import re

class Node:
    def __init__(self, name, is_dir=False, parent=None):
        self.name = name
        self.is_dir = is_dir
        self.parent = parent
        self.children = {}
        self.content = ""
        self.permissions = 0o755 if is_dir else 0o644

class VirtualFileSystem:
    def __init__(self):
        self.root = Node("home", is_dir=True)
        self.player_dir = Node("player", is_dir=True, parent=self.root)
        self.root.children["player"] = self.player_dir

        projects = Node("projects", is_dir=True, parent=self.player_dir)
        self.player_dir.children["projects"] = projects

        docs = Node("docs", is_dir=True, parent=self.player_dir)
        self.player_dir.children["docs"] = docs

        readme = Node("README.txt", is_dir=False, parent=docs)
        readme.content = "Welcome to Linux Academy!\nExplore the filesystem to learn commands.\nThis file contains mission-critical data.\nHandle with care."
        docs.children["README.txt"] = readme

        mission = Node("mission.txt", is_dir=False, parent=self.player_dir)
        mission.content = "MISSION BRIEFING\n================\nYour task: Master the Linux command line.\nComplete all missions to secure the system.\nGood luck, operator."
        self.player_dir.children["mission.txt"] = mission

        self.current_dir = self.player_dir
        self.pwd_path = "/home/player"
        self.command_history = []

    def _update_pwd(self):
        path_parts = []
        curr = self.current_dir
        while curr is not None:
            path_parts.insert(0, curr.name)
            curr = curr.parent
        # path_parts[0] = "home", so full path is /home/player/...
        self.pwd_path = "/" + "/".join(path_parts)

    def _resolve_path(self, target):
        if not target:
            return self.player_dir
        if target in ("~", "/home/player"):
            return self.player_dir
        if target == "/":
            return self.root
        # Absolute path
        if target.startswith("/"):
            parts = [p for p in target.split("/") if p]
            node = self.root
            # root is "home", so skip first "home" segment if present
            if parts and parts[0] == "home":
                parts = parts[1:]
            for part in parts:
                if part in node.children:
                    node = node.children[part]
                else:
                    return None
            return node
        # Relative path
        parts = target.split("/")
        node = self.current_dir
        for part in parts:
            if not part or part == ".":
                continue
            elif part == "..":
                node = node.parent if node.parent else node
            else:
                if part in node.children:
                    node = node.children[part]
                else:
                    return None
        return node

    def _parse_redirects(self, args):
        """
        Split args into (cmd_args, redirect_mode, redirect_file).
        redirect_mode: None, '>', '>>'
        Handles both ['echo', 'foo', '>', 'file'] and ['echo', 'foo', '>file'] forms.
        """
        cmd_args = []
        redirect_mode = None
        redirect_file = None
        i = 0
        while i < len(args):
            a = args[i]
            if a == ">>":
                redirect_mode = ">>"
                if i + 1 < len(args):
                    redirect_file = args[i + 1]
                    i += 2
                else:
                    i += 1
            elif a == ">":
                redirect_mode = ">"
                if i + 1 < len(args):
                    redirect_file = args[i + 1]
                    i += 2
                else:
                    i += 1
            elif a.startswith(">>"):
                redirect_mode = ">>"
                redirect_file = a[2:]
                i += 1
            elif a.startswith(">"):
                redirect_mode = ">"
                redirect_file = a[1:]
                i += 1
            else:
                cmd_args.append(a)
                i += 1
        return cmd_args, redirect_mode, redirect_file

    def _write_redirect(self, text, mode, filename):
        """Write text to filename with > or >> semantics."""
        if "/" in filename:
            parts = filename.rsplit("/", 1)
            parent_node = self._resolve_path(parts[0])
            if parent_node is None or not parent_node.is_dir:
                return {"status": "error", "output": f"bash: {filename}: No such file or directory"}
            dir_node = parent_node
            fname = parts[1]
        else:
            dir_node = self.current_dir
            fname = filename

        if fname not in dir_node.children:
            dir_node.children[fname] = Node(fname, is_dir=False, parent=dir_node)
        node = dir_node.children[fname]
        if node.is_dir:
            return {"status": "error", "output": f"bash: {filename}: Is a directory"}
        if mode == ">>":
            node.content = (node.content + "\n" + text).lstrip("\n")
        else:
            node.content = text
        return None  # no error

    def _pipe(self, left_output, right_cmd_parts):
        """Run right_cmd_parts with left_output fed as stdin (for grep/wc/head/tail)."""
        cmd = right_cmd_parts[0]
        args = right_cmd_parts[1:]
        # ls outputs space-separated names; normalise to one-per-line for piping
        raw_lines = left_output.split("\n")
        lines = []
        for l in raw_lines:
            # If the line looks like space-separated tokens (ls output), split it
            if "  " in l and "\t" not in l and not l.startswith(" "):
                lines.extend(t for t in l.split() if t)
            else:
                lines.append(l)

        if cmd == "grep":
            flags = [a for a in args if a.startswith("-")]
            positional = [a for a in args if not a.startswith("-")]
            if not positional:
                return {"status": "error", "output": "grep: missing pattern"}
            pattern = positional[0]
            case_flag = re.IGNORECASE if "-i" in flags else 0
            matches = [l for l in lines if re.search(pattern, l, case_flag)]
            return {"status": "success", "output": "\n".join(matches)}

        elif cmd == "wc":
            flags = [a for a in args if a.startswith("-")]
            content = left_output
            wc_lines = len(lines)
            wc_words = len(content.split())
            wc_chars = len(content)
            if "-l" in flags:
                return {"status": "success", "output": str(wc_lines)}
            elif "-w" in flags:
                return {"status": "success", "output": str(wc_words)}
            elif "-c" in flags:
                return {"status": "success", "output": str(wc_chars)}
            return {"status": "success", "output": f"{wc_lines} {wc_words} {wc_chars}"}

        elif cmd == "head":
            flags = [a for a in args if a.startswith("-")]
            n = 10
            for f in flags:
                if f[1:].isdigit():
                    n = int(f[1:])
            return {"status": "success", "output": "\n".join(lines[:n])}

        elif cmd == "tail":
            flags = [a for a in args if a.startswith("-")]
            n = 10
            for f in flags:
                if f[1:].isdigit():
                    n = int(f[1:])
            return {"status": "success", "output": "\n".join(lines[-n:])}

        elif cmd == "sort":
            reverse = "-r" in args
            return {"status": "success", "output": "\n".join(sorted(lines, reverse=reverse))}

        elif cmd == "uniq":
            seen = []
            for l in lines:
                if not seen or l != seen[-1]:
                    seen.append(l)
            return {"status": "success", "output": "\n".join(seen)}

        else:
            return {"status": "error", "output": f"{cmd}: command not found"}

    def execute(self, command_str):
        if not command_str.strip():
            return {"status": "success", "output": ""}

        self.command_history.append(command_str.strip())

        # ── Pipe handling ────────────────────────────────────────────────────
        # Split on unquoted | characters
        pipe_parts = self._split_pipes(command_str.strip())
        if len(pipe_parts) > 1:
            result = {"status": "success", "output": ""}
            for part in pipe_parts:
                try:
                    tokens = shlex.split(part.strip())
                except ValueError:
                    tokens = part.strip().split()
                if not tokens:
                    continue
                # Run right side as pipe consumer if we have prior output
                if result["status"] == "success" and pipe_parts.index(part) > 0:
                    result = self._pipe(result["output"], tokens)
                else:
                    result = self._execute_single(tokens)
                if result["status"] == "error":
                    break
            return result

        try:
            parts = shlex.split(command_str.strip())
        except ValueError:
            parts = command_str.strip().split()

        if not parts:
            return {"status": "success", "output": ""}

        return self._execute_single(parts)

    def _split_pipes(self, cmd_str):
        """Split command string on | respecting quotes."""
        parts = []
        current = []
        in_single = False
        in_double = False
        for ch in cmd_str:
            if ch == "'" and not in_double:
                in_single = not in_single
                current.append(ch)
            elif ch == '"' and not in_single:
                in_double = not in_double
                current.append(ch)
            elif ch == "|" and not in_single and not in_double:
                parts.append("".join(current))
                current = []
            else:
                current.append(ch)
        parts.append("".join(current))
        return parts

    def _execute_single(self, parts):
        cmd = parts[0]
        args = parts[1:]

        if cmd == "clear":
            return {"status": "success", "event": "CLEAR_TERMINAL", "output": ""}

        elif cmd == "pwd":
            return {"status": "success", "output": self.pwd_path}

        elif cmd == "ls":
            show_all = "-a" in args or any(a in ("-la", "-al", "-all") for a in args)
            long_fmt = "-l" in args or any(a in ("-la", "-al") for a in args)
            target_args = [a for a in args if not a.startswith("-")]
            if target_args:
                node = self._resolve_path(target_args[0])
                if node is None:
                    return {"status": "error", "output": f"ls: cannot access '{target_args[0]}': No such file or directory"}
                if not node.is_dir:
                    return {"status": "success", "output": node.name}
                listing = node.children
            else:
                listing = self.current_dir.children

            entries = list(listing.values())
            if not show_all:
                entries = [e for e in entries if not e.name.startswith(".")]

            if long_fmt:
                lines = []
                for e in sorted(entries, key=lambda x: x.name):
                    kind = "d" if e.is_dir else "-"
                    mode = e.permissions
                    perm = self._format_perm(mode, e.is_dir)
                    size = len(e.content) if not e.is_dir else 4096
                    lines.append(f"{perm}  1 player player {size:6d} Jun 12 10:00 {e.name}")
                return {"status": "success", "output": "\n".join(lines) if lines else ""}
            else:
                names = sorted([e.name + ("/" if e.is_dir else "") for e in entries])
                return {"status": "success", "output": "  ".join(names) if names else ""}

        elif cmd == "mkdir":
            if not args:
                return {"status": "error", "output": "mkdir: missing operand"}
            flags = [a for a in args if a.startswith("-")]
            targets = [a for a in args if not a.startswith("-")]
            parents = "-p" in flags
            results = []
            for target in targets:
                parts_path = target.split("/")
                node = self.current_dir
                for i, part in enumerate(parts_path):
                    if not part:
                        continue
                    if part in node.children:
                        if node.children[part].is_dir:
                            node = node.children[part]
                        else:
                            results.append(f"mkdir: cannot create directory '{target}': File exists")
                            break
                    else:
                        if i < len(parts_path) - 1 and not parents:
                            results.append(f"mkdir: cannot create directory '{target}': No such file or directory")
                            break
                        new_dir = Node(part, is_dir=True, parent=node)
                        node.children[part] = new_dir
                        node = new_dir
            if results:
                return {"status": "error", "output": "\n".join(results)}
            return {"status": "success", "output": ""}

        elif cmd == "touch":
            if not args:
                return {"status": "error", "output": "touch: missing file operand"}
            for target in [a for a in args if not a.startswith("-")]:
                if "/" in target:
                    parts_path = target.rsplit("/", 1)
                    parent_node = self._resolve_path(parts_path[0])
                    if parent_node is None or not parent_node.is_dir:
                        return {"status": "error", "output": f"touch: cannot touch '{target}': No such file or directory"}
                    fname = parts_path[1]
                    if fname not in parent_node.children:
                        parent_node.children[fname] = Node(fname, is_dir=False, parent=parent_node)
                else:
                    if target not in self.current_dir.children:
                        self.current_dir.children[target] = Node(target, is_dir=False, parent=self.current_dir)
            return {"status": "success", "output": ""}

        elif cmd == "cd":
            target = args[0] if args else "~"
            if target in ("~", "/home/player"):
                self.current_dir = self.player_dir
                self._update_pwd()
                return {"status": "success", "output": ""}
            if target == "..":
                if self.current_dir.parent:
                    self.current_dir = self.current_dir.parent
                self._update_pwd()
                return {"status": "success", "output": ""}
            if target == "-":
                # cd - not supported in VFS, just no-op
                return {"status": "success", "output": self.pwd_path}
            node = self._resolve_path(target)
            if node is None:
                return {"status": "error", "output": f"cd: {target}: No such file or directory"}
            if not node.is_dir:
                return {"status": "error", "output": f"cd: {target}: Not a directory"}
            self.current_dir = node
            self._update_pwd()
            return {"status": "success", "output": ""}

        elif cmd == "cat":
            if not args:
                return {"status": "error", "output": "cat: missing file operand"}
            real_args, redir_mode, redir_file = self._parse_redirects(args)
            outputs = []
            for target in [a for a in real_args if not a.startswith("-")]:
                node = self._resolve_path(target)
                if node is None:
                    return {"status": "error", "output": f"cat: {target}: No such file or directory"}
                if node.is_dir:
                    return {"status": "error", "output": f"cat: {target}: Is a directory"}
                outputs.append(node.content if node.content else "")
            combined = "\n".join(outputs)
            if redir_mode and redir_file:
                err = self._write_redirect(combined, redir_mode, redir_file)
                if err:
                    return err
                return {"status": "success", "output": ""}
            return {"status": "success", "output": combined}

        elif cmd == "echo":
            real_args, redir_mode, redir_file = self._parse_redirects(args)
            # -n flag suppresses newline (we just strip it in output)
            no_newline = "-n" in real_args
            text_parts = [a for a in real_args if a != "-n" and a != "-e"]
            text = " ".join(text_parts)
            if redir_mode and redir_file:
                err = self._write_redirect(text, redir_mode, redir_file)
                if err:
                    return err
                return {"status": "success", "output": ""}
            return {"status": "success", "output": text}

        elif cmd == "cp":
            if len(args) < 2:
                return {"status": "error", "output": "cp: missing destination file operand"}
            flags = [a for a in args if a.startswith("-")]
            positional = [a for a in args if not a.startswith("-")]
            src, dst = positional[0], positional[1]
            src_node = self._resolve_path(src)
            if src_node is None:
                return {"status": "error", "output": f"cp: '{src}': No such file or directory"}
            if src_node.is_dir and "-r" not in flags and "-R" not in flags:
                return {"status": "error", "output": f"cp: -r not specified; omitting directory '{src}'"}
            dst_node = self._resolve_path(dst)
            if dst_node and dst_node.is_dir:
                new_name = src_node.name
                new_node = Node(new_name, is_dir=src_node.is_dir, parent=dst_node)
                new_node.content = src_node.content
                dst_node.children[new_name] = new_node
            else:
                parts_dst = dst.rsplit("/", 1)
                if len(parts_dst) == 2:
                    parent_node = self._resolve_path(parts_dst[0])
                    if parent_node is None:
                        return {"status": "error", "output": f"cp: cannot create '{dst}': No such file or directory"}
                    new_name = parts_dst[1]
                    new_node = Node(new_name, is_dir=src_node.is_dir, parent=parent_node)
                    new_node.content = src_node.content
                    parent_node.children[new_name] = new_node
                else:
                    new_node = Node(dst, is_dir=src_node.is_dir, parent=self.current_dir)
                    new_node.content = src_node.content
                    self.current_dir.children[dst] = new_node
            return {"status": "success", "output": ""}

        elif cmd == "mv":
            if len(args) < 2:
                return {"status": "error", "output": "mv: missing destination file operand"}
            positional = [a for a in args if not a.startswith("-")]
            src, dst = positional[0], positional[1]
            src_node = self._resolve_path(src)
            if src_node is None:
                return {"status": "error", "output": f"mv: '{src}': No such file or directory"}
            src_parent = src_node.parent
            if src_parent and src_node.name in src_parent.children:
                del src_parent.children[src_node.name]
            dst_node = self._resolve_path(dst)
            if dst_node and dst_node.is_dir:
                src_node.parent = dst_node
                dst_node.children[src_node.name] = src_node
            else:
                parts_dst = dst.rsplit("/", 1)
                if len(parts_dst) == 2:
                    parent_node = self._resolve_path(parts_dst[0])
                    if parent_node is None:
                        return {"status": "error", "output": f"mv: cannot move to '{dst}': No such file or directory"}
                    src_node.name = parts_dst[1]
                    src_node.parent = parent_node
                    parent_node.children[parts_dst[1]] = src_node
                else:
                    src_node.name = dst
                    src_node.parent = self.current_dir
                    self.current_dir.children[dst] = src_node
            return {"status": "success", "output": ""}

        elif cmd == "rm":
            if not args:
                return {"status": "error", "output": "rm: missing operand"}
            # Parse flags robustly: -rf, -fr, -r -f, -r, -f all work
            flag_str = ""
            targets = []
            for a in args:
                if a.startswith("-"):
                    flag_str += a[1:]
                else:
                    targets.append(a)
            recursive = "r" in flag_str or "R" in flag_str
            force = "f" in flag_str
            for target in targets:
                node = self._resolve_path(target)
                if node is None:
                    if force:
                        continue
                    return {"status": "error", "output": f"rm: cannot remove '{target}': No such file or directory"}
                if node.is_dir and not recursive:
                    return {"status": "error", "output": f"rm: cannot remove '{target}': Is a directory"}
                parent = node.parent
                if parent and node.name in parent.children:
                    del parent.children[node.name]
            return {"status": "success", "output": ""}

        elif cmd == "rmdir":
            if not args:
                return {"status": "error", "output": "rmdir: missing operand"}
            for target in args:
                node = self._resolve_path(target)
                if node is None:
                    return {"status": "error", "output": f"rmdir: failed to remove '{target}': No such file or directory"}
                if not node.is_dir:
                    return {"status": "error", "output": f"rmdir: failed to remove '{target}': Not a directory"}
                if node.children:
                    return {"status": "error", "output": f"rmdir: failed to remove '{target}': Directory not empty"}
                parent = node.parent
                if parent:
                    del parent.children[node.name]
            return {"status": "success", "output": ""}

        elif cmd == "grep":
            if len(args) < 1:
                return {"status": "error", "output": "grep: usage: grep PATTERN FILE"}
            flags = [a for a in args if a.startswith("-")]
            positional = [a for a in args if not a.startswith("-")]
            if len(positional) < 2:
                return {"status": "error", "output": "grep: usage: grep PATTERN FILE"}
            pattern, filename = positional[0], positional[1]
            node = self._resolve_path(filename)
            if node is None:
                return {"status": "error", "output": f"grep: {filename}: No such file or directory"}
            if node.is_dir:
                return {"status": "error", "output": f"grep: {filename}: Is a directory"}
            case_flag = re.IGNORECASE if "-i" in flags else 0
            lines = node.content.split("\n")
            matches = [l for l in lines if re.search(pattern, l, case_flag)]
            return {"status": "success", "output": "\n".join(matches)}

        elif cmd == "find":
            path_arg = "." if not args else args[0]
            name_filter = None
            type_filter = None
            if "-name" in args:
                idx = args.index("-name")
                if idx + 1 < len(args):
                    name_filter = args[idx + 1].strip("'\"")
            if "-type" in args:
                idx = args.index("-type")
                if idx + 1 < len(args):
                    type_filter = args[idx + 1]
            start = self.current_dir if path_arg == "." else self._resolve_path(path_arg)
            if start is None:
                return {"status": "error", "output": f"find: '{path_arg}': No such file or directory"}
            results = []
            prefix = path_arg if path_arg != "." else "."
            results.append(prefix)
            def walk(node, pfx):
                for name, child in sorted(node.children.items()):
                    full = pfx + "/" + name
                    type_ok = (type_filter is None or
                               (type_filter == "d" and child.is_dir) or
                               (type_filter == "f" and not child.is_dir))
                    name_ok = name_filter is None or name == name_filter
                    if type_ok and name_ok:
                        results.append(full)
                    elif name_filter is None and type_filter is None:
                        results.append(full)
                    if child.is_dir:
                        walk(child, full)
            walk(start, prefix)
            return {"status": "success", "output": "\n".join(results)}

        elif cmd == "chmod":
            if len(args) < 2:
                return {"status": "error", "output": "chmod: missing operand"}
            mode_str = args[0]
            target = args[-1]
            node = self._resolve_path(target)
            if node is None:
                return {"status": "error", "output": f"chmod: cannot access '{target}': No such file or directory"}
            try:
                node.permissions = int(mode_str, 8)
            except ValueError:
                pass  # symbolic modes like +x ignored in VFS
            return {"status": "success", "output": ""}

        elif cmd == "wc":
            if not args:
                return {"status": "error", "output": "wc: missing file operand"}
            flags = [a for a in args if a.startswith("-")]
            targets = [a for a in args if not a.startswith("-")]
            lines_out = []
            for target in targets:
                node = self._resolve_path(target)
                if node is None:
                    return {"status": "error", "output": f"wc: {target}: No such file or directory"}
                content = node.content
                wc_lines = len(content.split("\n")) if content else 0
                wc_words = len(content.split()) if content else 0
                wc_chars = len(content)
                if "-l" in flags:
                    lines_out.append(f"{wc_lines} {target}")
                elif "-w" in flags:
                    lines_out.append(f"{wc_words} {target}")
                elif "-c" in flags:
                    lines_out.append(f"{wc_chars} {target}")
                else:
                    lines_out.append(f"{wc_lines} {wc_words} {wc_chars} {target}")
            return {"status": "success", "output": "\n".join(lines_out)}

        elif cmd == "head":
            flags = [a for a in args if a.startswith("-")]
            positional = [a for a in args if not a.startswith("-")]
            n = 10
            for f in flags:
                if f[1:].isdigit():
                    n = int(f[1:])
            if not positional:
                return {"status": "error", "output": "head: missing file operand"}
            node = self._resolve_path(positional[0])
            if node is None:
                return {"status": "error", "output": f"head: {positional[0]}: No such file or directory"}
            lines = node.content.split("\n")[:n]
            return {"status": "success", "output": "\n".join(lines)}

        elif cmd == "tail":
            flags = [a for a in args if a.startswith("-")]
            positional = [a for a in args if not a.startswith("-")]
            n = 10
            for f in flags:
                if f[1:].isdigit():
                    n = int(f[1:])
            if not positional:
                return {"status": "error", "output": "tail: missing file operand"}
            node = self._resolve_path(positional[0])
            if node is None:
                return {"status": "error", "output": f"tail: {positional[0]}: No such file or directory"}
            lines = node.content.split("\n")[-n:]
            return {"status": "success", "output": "\n".join(lines)}

        elif cmd == "sort":
            flags = [a for a in args if a.startswith("-")]
            positional = [a for a in args if not a.startswith("-")]
            reverse = "-r" in flags
            if not positional:
                return {"status": "error", "output": "sort: missing file operand"}
            node = self._resolve_path(positional[0])
            if node is None:
                return {"status": "error", "output": f"sort: {positional[0]}: No such file or directory"}
            lines = sorted(node.content.split("\n"), reverse=reverse)
            return {"status": "success", "output": "\n".join(lines)}

        elif cmd == "uniq":
            positional = [a for a in args if not a.startswith("-")]
            if not positional:
                return {"status": "error", "output": "uniq: missing file operand"}
            node = self._resolve_path(positional[0])
            if node is None:
                return {"status": "error", "output": f"uniq: {positional[0]}: No such file or directory"}
            lines = node.content.split("\n")
            seen = []
            for l in lines:
                if not seen or l != seen[-1]:
                    seen.append(l)
            return {"status": "success", "output": "\n".join(seen)}

        elif cmd == "history":
            return {"status": "success", "output": "\n".join(f"  {i+1}  {c}" for i, c in enumerate(self.command_history))}

        elif cmd == "man":
            manuals = {
                "ls":      "ls - list directory contents\nUsage: ls [-la] [path]\nFlags: -l (long format), -a (all including hidden)",
                "cd":      "cd - change directory\nUsage: cd [directory]\nSpecial: cd ~ (home), cd .. (parent)",
                "pwd":     "pwd - print working directory\nUsage: pwd",
                "mkdir":   "mkdir - make directories\nUsage: mkdir [-p] DIRECTORY...\nFlags: -p (create parent dirs)",
                "touch":   "touch - create empty file or update timestamp\nUsage: touch FILE...",
                "cat":     "cat - concatenate and print files\nUsage: cat FILE...",
                "echo":    "echo - print text or write to file\nUsage: echo TEXT [> FILE] [>> FILE]\n> overwrites, >> appends",
                "rm":      "rm - remove files or directories\nUsage: rm [-rf] FILE...\nFlags: -r (recursive), -f (force)",
                "cp":      "cp - copy files\nUsage: cp [-r] SOURCE DEST",
                "mv":      "mv - move/rename files\nUsage: mv SOURCE DEST",
                "grep":    "grep - search text in files\nUsage: grep [-i] PATTERN FILE\nFlags: -i (case insensitive)\nAlso works in pipes: ls | grep foo",
                "find":    "find - find files\nUsage: find [PATH] [-name PATTERN] [-type f|d]",
                "chmod":   "chmod - change file permissions\nUsage: chmod MODE FILE\nExample: chmod 755 script.sh",
                "wc":      "wc - word, line, character count\nUsage: wc [-lwc] FILE\nFlags: -l (lines), -w (words), -c (chars)",
                "head":    "head - output first N lines\nUsage: head [-N] FILE\nDefault: 10 lines",
                "tail":    "tail - output last N lines\nUsage: tail [-N] FILE\nDefault: 10 lines",
                "sort":    "sort - sort lines of a file\nUsage: sort [-r] FILE\nFlags: -r (reverse)",
                "uniq":    "uniq - remove duplicate adjacent lines\nUsage: uniq FILE",
                "pipe":    "pipe (|) - chain commands\nUsage: COMMAND1 | COMMAND2\nExample: ls | grep txt\nExample: cat file | wc -l",
            }
            if not args:
                return {"status": "success", "output": "Available man pages:\n" + "  ".join(manuals.keys())}
            topic = args[0]
            if topic in manuals:
                return {"status": "success", "output": manuals[topic]}
            return {"status": "error", "output": f"man: {topic}: No entry for {topic}"}

        elif cmd == "help":
            return {"status": "success", "output": (
                "Available commands:\n"
                "  ls  cd  pwd  mkdir  touch  cat  echo  rm  rmdir  cp  mv\n"
                "  grep  find  chmod  wc  head  tail  sort  uniq\n"
                "  history  man  clear  help\n\n"
                "Pipe support:  ls | grep txt\n"
                "Redirection:   echo hello > file.txt\n"
                "               echo more >> file.txt\n"
                "Try 'man COMMAND' for details."
            )}

        else:
            return {"status": "error", "output": f"{cmd}: command not found\nTry 'help' for available commands."}

    def _format_perm(self, mode, is_dir):
        d = "d" if is_dir else "-"
        bits = []
        for shift in (6, 3, 0):
            b = (mode >> shift) & 7
            bits.append("r" if b & 4 else "-")
            bits.append("w" if b & 2 else "-")
            bits.append("x" if b & 1 else "-")
        return d + "".join(bits)

    def get_completions(self, partial_cmd):
        """
        Return tab-completion candidates for partial_cmd.
        If only one token: complete command names.
        If multiple tokens: complete filenames/dirnames relative to current dir.
        """
        tokens = partial_cmd.split(" ")
        COMMANDS = [
            "ls", "cd", "pwd", "mkdir", "touch", "cat", "echo", "rm", "rmdir",
            "cp", "mv", "grep", "find", "chmod", "wc", "head", "tail", "sort",
            "uniq", "history", "man", "clear", "help"
        ]
        if len(tokens) == 1:
            prefix = tokens[0]
            return [c for c in COMMANDS if c.startswith(prefix)]

        # Complete the last token as a path
        last = tokens[-1]
        if "/" in last:
            dir_part, file_prefix = last.rsplit("/", 1)
            dir_node = self._resolve_path(dir_part)
            if dir_node is None or not dir_node.is_dir:
                return []
            candidates = [
                dir_part + "/" + name + ("/" if child.is_dir else "")
                for name, child in dir_node.children.items()
                if name.startswith(file_prefix)
            ]
        else:
            file_prefix = last
            candidates = [
                name + ("/" if child.is_dir else "")
                for name, child in self.current_dir.children.items()
                if name.startswith(file_prefix)
            ]
        return sorted(candidates)

vfs = VirtualFileSystem()
