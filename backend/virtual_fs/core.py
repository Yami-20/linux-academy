import os
import shlex

class Node:
    def __init__(self, name, is_dir=False, parent=None):
        self.name = name
        self.is_dir = is_dir
        self.parent = parent
        self.children = {}
        self.content = ""

class VirtualFileSystem:
    def __init__(self):
        self.root = Node("home", is_dir=True)
        self.player_dir = Node("player", is_dir=True, parent=self.root)
        self.root.children["player"] = self.player_dir

        # Seed world zones with pre-existing dirs/files
        projects = Node("projects", is_dir=True, parent=self.player_dir)
        self.player_dir.children["projects"] = projects

        docs = Node("docs", is_dir=True, parent=self.player_dir)
        self.player_dir.children["docs"] = docs

        readme = Node("README.txt", is_dir=False, parent=docs)
        readme.content = "Welcome to Linux Academy!\nExplore the filesystem to learn commands."
        docs.children["README.txt"] = readme

        mission = Node("mission.txt", is_dir=False, parent=self.player_dir)
        mission.content = "MISSION BRIEFING\n================\nYour task: Master the Linux command line.\nComplete all missions to secure the system."
        self.player_dir.children["mission.txt"] = mission

        self.current_dir = self.player_dir
        self.pwd_path = "/home/player"
        self.command_history = []

    def _update_pwd(self):
        path = []
        curr = self.current_dir
        while curr is not None:
            path.insert(0, curr.name)
            curr = curr.parent
        self.pwd_path = "/" + "/".join(path[1:]) if len(path) > 1 else "/home"

    def _resolve_path(self, target):
        """Resolve a target path relative to current_dir or absolute."""
        if not target:
            return self.player_dir
        if target == "~":
            return self.player_dir
        if target == "/":
            return self.root
        parts = target.split("/")
        node = self.current_dir
        for part in parts:
            if not part or part == ".":
                continue
            elif part == "..":
                if node.parent:
                    node = node.parent
            else:
                if part in node.children:
                    node = node.children[part]
                else:
                    return None
        return node

    def execute(self, command_str):
        if not command_str.strip():
            return {"status": "success", "output": ""}

        self.command_history.append(command_str.strip())

        try:
            parts = shlex.split(command_str.strip())
        except ValueError:
            parts = command_str.strip().split()

        cmd = parts[0]
        args = parts[1:]

        if cmd == "clear":
            return {"status": "success", "event": "CLEAR_TERMINAL", "output": ""}

        elif cmd == "pwd":
            return {"status": "success", "output": self.pwd_path}

        elif cmd == "ls":
            show_all = "-a" in args or "-la" in args or "-al" in args
            long_fmt = "-l" in args or "-la" in args or "-al" in args
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
                    perm = "rwxr-xr-x" if e.is_dir else "rw-r--r--"
                    size = len(e.content) if not e.is_dir else 0
                    lines.append(f"{kind}{perm}  1 player player {size:6d} Jun 12 10:00 {e.name}")
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
            for target in args:
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
            if target == "~" or target == "/home/player":
                self.current_dir = self.player_dir
                self._update_pwd()
                return {"status": "success", "output": ""}
            if target == "..":
                if self.current_dir.parent:
                    self.current_dir = self.current_dir.parent
                    self._update_pwd()
                return {"status": "success", "output": ""}
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
            outputs = []
            for target in [a for a in args if not a.startswith("-")]:
                node = self._resolve_path(target)
                if node is None:
                    return {"status": "error", "output": f"cat: {target}: No such file or directory"}
                if node.is_dir:
                    return {"status": "error", "output": f"cat: {target}: Is a directory"}
                outputs.append(node.content if node.content else "")
            return {"status": "success", "output": "\n".join(outputs)}

        elif cmd == "echo":
            full_args = " ".join(args)
            if ">>" in full_args:
                text_part, file_part = full_args.split(">>", 1)
                text = text_part.strip().strip('"').strip("'")
                target = file_part.strip()
                if target not in self.current_dir.children:
                    self.current_dir.children[target] = Node(target, is_dir=False, parent=self.current_dir)
                node = self.current_dir.children[target]
                if node.is_dir:
                    return {"status": "error", "output": f"echo: {target}: Is a directory"}
                node.content = (node.content + "\n" + text).lstrip("\n")
                return {"status": "success", "output": ""}
            elif ">" in full_args:
                text_part, file_part = full_args.split(">", 1)
                text = text_part.strip().strip('"').strip("'")
                target = file_part.strip()
                if target not in self.current_dir.children:
                    self.current_dir.children[target] = Node(target, is_dir=False, parent=self.current_dir)
                node = self.current_dir.children[target]
                if node.is_dir:
                    return {"status": "error", "output": f"echo: {target}: Is a directory"}
                node.content = text
                return {"status": "success", "output": ""}
            else:
                text = full_args.strip('"').strip("'")
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
            if src_parent:
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
            flags = [a for a in args if a.startswith("-")]
            targets = [a for a in args if not a.startswith("-")]
            recursive = "-r" in flags or "-R" in flags or "-rf" in flags or "-fr" in flags
            force = "-f" in flags or "-rf" in flags or "-fr" in flags
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
            if len(args) < 2:
                return {"status": "error", "output": "grep: usage: grep PATTERN FILE"}
            flags = [a for a in args if a.startswith("-")]
            positional = [a for a in args if not a.startswith("-")]
            pattern, filename = positional[0], positional[1]
            node = self._resolve_path(filename)
            if node is None:
                return {"status": "error", "output": f"grep: {filename}: No such file or directory"}
            if node.is_dir:
                return {"status": "error", "output": f"grep: {filename}: Is a directory"}
            import re
            case_flag = re.IGNORECASE if "-i" in flags else 0
            lines = node.content.split("\n")
            matches = [l for l in lines if re.search(pattern, l, case_flag)]
            if not matches:
                return {"status": "success", "output": ""}
            return {"status": "success", "output": "\n".join(matches)}

        elif cmd == "find":
            path_arg = "." if not args else args[0]
            name_filter = None
            if "-name" in args:
                idx = args.index("-name")
                if idx + 1 < len(args):
                    name_filter = args[idx + 1].strip("'\"")
            start = self.current_dir if path_arg == "." else self._resolve_path(path_arg)
            if start is None:
                return {"status": "error", "output": f"find: '{path_arg}': No such file or directory"}
            results = []
            def walk(node, prefix):
                for name, child in node.children.items():
                    full = prefix + "/" + name
                    if name_filter is None or name == name_filter:
                        results.append(full)
                    if child.is_dir:
                        walk(child, full)
            walk(start, path_arg if path_arg != "." else ".")
            return {"status": "success", "output": "\n".join(results) if results else ""}

        elif cmd == "chmod":
            if len(args) < 2:
                return {"status": "error", "output": "chmod: missing operand"}
            target = args[-1]
            node = self._resolve_path(target)
            if node is None:
                return {"status": "error", "output": f"chmod: cannot access '{target}': No such file or directory"}
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
                if f.startswith("-") and f[1:].isdigit():
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
                if f.startswith("-") and f[1:].isdigit():
                    n = int(f[1:])
            if not positional:
                return {"status": "error", "output": "tail: missing file operand"}
            node = self._resolve_path(positional[0])
            if node is None:
                return {"status": "error", "output": f"tail: {positional[0]}: No such file or directory"}
            lines = node.content.split("\n")[-n:]
            return {"status": "success", "output": "\n".join(lines)}

        elif cmd == "history":
            return {"status": "success", "output": "\n".join(f"  {i+1}  {c}" for i, c in enumerate(self.command_history))}

        elif cmd == "man":
            manuals = {
                "ls": "ls - list directory contents\nUsage: ls [-la] [path]\nFlags: -l (long), -a (all, include hidden)",
                "cd": "cd - change directory\nUsage: cd [directory]\nSpecial: cd ~ (home), cd .. (parent)",
                "pwd": "pwd - print working directory\nUsage: pwd",
                "mkdir": "mkdir - make directories\nUsage: mkdir [-p] DIRECTORY\nFlags: -p (create parents)",
                "touch": "touch - create empty file or update timestamp\nUsage: touch FILE",
                "cat": "cat - concatenate and print files\nUsage: cat FILE",
                "echo": "echo - print text or write to file\nUsage: echo TEXT [> FILE] [>> FILE]",
                "rm": "rm - remove files or directories\nUsage: rm [-rf] FILE\nFlags: -r (recursive), -f (force)",
                "cp": "cp - copy files\nUsage: cp [-r] SOURCE DEST",
                "mv": "mv - move/rename files\nUsage: mv SOURCE DEST",
                "grep": "grep - search text in files\nUsage: grep [-i] PATTERN FILE\nFlags: -i (case insensitive)",
                "find": "find - find files\nUsage: find [PATH] [-name PATTERN]",
                "chmod": "chmod - change file permissions\nUsage: chmod MODE FILE",
                "wc": "wc - word count\nUsage: wc [-lwc] FILE",
                "head": "head - output first lines\nUsage: head [-N] FILE",
                "tail": "tail - output last lines\nUsage: tail [-N] FILE",
            }
            if not args:
                return {"status": "success", "output": "Available man pages:\n" + "  ".join(manuals.keys())}
            topic = args[0]
            if topic in manuals:
                return {"status": "success", "output": manuals[topic]}
            return {"status": "error", "output": f"man: {topic}: No entry for {topic}"}

        elif cmd == "help":
            return {"status": "success", "output": "Available commands:\nls  cd  pwd  mkdir  touch  cat  echo  rm  rmdir  cp  mv\ngrep  find  chmod  wc  head  tail  history  man  clear  help"}

        else:
            return {"status": "error", "output": f"{cmd}: command not found\nTry 'help' for available commands."}

vfs = VirtualFileSystem()
